// lib/solvers/RectDiffSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"

import type { GridFill3DOptions, RectDiffState } from "./rectdiff/types"
import {
  initState,
  stepGrid,
  stepExpansion,
  finalizeRects,
  computeProgress,
} from "./rectdiff/engine"
import { rectsToMeshNodes } from "./rectdiff/rectsToMeshNodes"

// A streaming, one-step-per-iteration solver.
// Tests that call `solver.solve()` still work because BaseSolver.solve()
// loops until this.solved flips true.

export class RectDiffSolver extends BaseSolver {
  private srj: SimpleRouteJson
  private mode: "grid" | "exact"
  private gridOptions: Partial<GridFill3DOptions>
  private state!: RectDiffState
  private _meshNodes: CapacityMeshNode[] = []

  // --- Add caching properties ---
  private _cachedIntermediateOutput: { meshNodes: CapacityMeshNode[] } | null =
    null
  private _cachedStateSignature: string = ""
  // ------------------------------

  constructor(opts: {
    simpleRouteJson: SimpleRouteJson
    mode?: "grid" | "exact"
    gridOptions?: Partial<GridFill3DOptions>
  }) {
    super()
    this.srj = opts.simpleRouteJson
    this.mode = opts.mode ?? "grid"
    this.gridOptions = opts.gridOptions ?? {}
  }

  override _setup() {
    // For now "exact" mode falls back to grid; keep switch if you add exact later.
    this.state = initState(this.srj, this.gridOptions)
    this.stats = {
      phase: this.state.phase,
      gridIndex: this.state.gridIndex,
    }
  }

  /** IMPORTANT: exactly ONE small step per call */
  override _step() {
    if (this.state.phase === "GRID") {
      stepGrid(this.state)
    } else if (this.state.phase === "EXPANSION") {
      stepExpansion(this.state)
    } else if (this.state.phase === "DONE") {
      // Finalize once
      if (!this.solved) {
        const rects = finalizeRects(this.state)
        this._meshNodes = rectsToMeshNodes(rects)
        this.solved = true
      }
      return
    }

    // Lightweight stats for debugger
    this.stats.phase = this.state.phase
    this.stats.gridIndex = this.state.gridIndex
    this.stats.placed = this.state.placed.length
  }

  // Let BaseSolver update this.progress automatically if present.
  computeProgress(): number {
    return computeProgress(this.state)
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    // If the solver is finished, return the final, cached result for performance.
    if (this.solved) {
      return { meshNodes: this._meshNodes }
    }

    // Create a signature based on current state to determine if we need to recompute
    const currentSignature = this.state
      ? JSON.stringify({
          phase: this.state.phase,
          gridIndex: this.state.gridIndex,
          placedCount: this.state.placed.length,
          expansionIndex: this.state.expansionIndex,
          candidatesCount: this.state.candidates.length,
          totalSeedsThisGrid: this.state.totalSeedsThisGrid,
          consumedSeedsThisGrid: this.state.consumedSeedsThisGrid,
        })
      : ""

    // --- Caching logic for intermediate state ---
    if (
      this._cachedStateSignature === currentSignature &&
      this._cachedIntermediateOutput
    ) {
      return this._cachedIntermediateOutput
    }
    // -------------------------------------------

    let result: { meshNodes: CapacityMeshNode[] }

    // If the solver is running, dynamically generate a snapshot of the current state.
    if (this.state?.placed) {
      const intermediateRects = finalizeRects(this.state)
      result = { meshNodes: rectsToMeshNodes(intermediateRects) }
    } else {
      // If there's no state yet, return an empty array.
      result = { meshNodes: [] }
    }

    // --- Cache the new output ---
    this._cachedIntermediateOutput = result
    this._cachedStateSignature = currentSignature
    return this._cachedIntermediateOutput
    // ----------------------------
  }

  // Helper to get color based on z layer
  private getColorForZLayer(zLayers: number[]): {
    fill: string
    stroke: string
  } {
    const minZ = Math.min(...zLayers)
    const colors = [
      { fill: "#dbeafe", stroke: "#3b82f6" }, // blue (z=0)
      { fill: "#fef3c7", stroke: "#f59e0b" }, // amber (z=1)
      { fill: "#d1fae5", stroke: "#10b981" }, // green (z=2)
      { fill: "#e9d5ff", stroke: "#a855f7" }, // purple (z=3)
      { fill: "#fed7aa", stroke: "#f97316" }, // orange (z=4)
      { fill: "#fecaca", stroke: "#ef4444" }, // red (z=5)
    ]
    return colors[minZ % colors.length]!
  }

  // Streaming visualization: board + obstacles + current placements.
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []

    // board
    rects.push({
      center: {
        x: (this.srj.bounds.minX + this.srj.bounds.maxX) / 2,
        y: (this.srj.bounds.minY + this.srj.bounds.maxY) / 2,
      },
      width: this.srj.bounds.maxX - this.srj.bounds.minX,
      height: this.srj.bounds.maxY - this.srj.bounds.minY,
      fill: "none",
      stroke: "#111827",
      label: "board",
    })

    // obstacles (rect & oval as bounding boxes)
    for (const ob of this.srj.obstacles ?? []) {
      if (ob.type === "rect" || ob.type === "oval") {
        rects.push({
          center: { x: ob.center.x, y: ob.center.y },
          width: ob.width,
          height: ob.height,
          fill: "#fee2e2",
          stroke: "#ef4444",
          layer: "obstacle",
          label: "obstacle",
        })
      }
    }

    // candidate positions (where expansion started from)
    if (this.state?.candidates?.length) {
      for (const cand of this.state.candidates) {
        points.push({
          x: cand.x,
          y: cand.y,
          fill: "#9333ea",
          stroke: "#6b21a8",
          label: `z:${cand.z}`,
        } as any)
      }
    }

    // current placements (streaming) if not yet solved
    if (this.state?.placed?.length) {
      for (const p of this.state.placed) {
        const colors = this.getColorForZLayer(p.zLayers)
        rects.push({
          center: {
            x: p.rect.x + p.rect.width / 2,
            y: p.rect.y + p.rect.height / 2,
          },
          width: p.rect.width,
          height: p.rect.height,
          fill: colors.fill,
          stroke: colors.stroke,
          label: `free\nz:${p.zLayers.join(",")}`,
        })
      }
    }

    return {
      title: "RectDiff (incremental)",
      coordinateSystem: "cartesian",
      rects,
      points,
    }
  }
}

// Re-export types for convenience
export type { GridFill3DOptions } from "./rectdiff/types"
