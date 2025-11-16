// lib/solvers/RectDiffSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"

import type { GridFill3DOptions, RectDiffState } from "./rectdiff/types"
import { initState, stepGrid, stepExpansion, finalizeRects, computeProgress } from "./rectdiff/engine"
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
    return { meshNodes: this._meshNodes }
  }

  // Streaming visualization: board + obstacles + current placements.
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []

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

    // current placements (streaming) if not yet solved
    if (this.state?.placed?.length) {
      for (const p of this.state.placed) {
        rects.push({
          center: { x: p.rect.x + p.rect.width / 2, y: p.rect.y + p.rect.height / 2 },
          width: p.rect.width,
          height: p.rect.height,
          fill: "#d1fae5",
          stroke: "#10b981",
          label: `free\nz:${p.zLayers.join(",")}`,
        })
      }
    }

    return {
      title: "RectDiff (incremental)",
      coordinateSystem: "cartesian",
      rects,
    }
  }
}

// Re-export types for convenience
export type { GridFill3DOptions } from "./rectdiff/types"
