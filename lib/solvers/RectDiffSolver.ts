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
import type { GapFillOptions } from "./rectdiff/gapfill/types"
import {
  findUncoveredPoints,
  calculateCoverage,
} from "./rectdiff/gapfill/engine"
import { GapFillSubSolver } from "./rectdiff/subsolvers/GapFillSubSolver"

/**
 * A streaming, one-step-per-iteration solver for capacity mesh generation.
 */
export class RectDiffSolver extends BaseSolver {
  private srj: SimpleRouteJson
  private gridOptions: Partial<GridFill3DOptions>
  private gapFillOptions: Partial<GapFillOptions>
  private state!: RectDiffState
  private _meshNodes: CapacityMeshNode[] = []

  /** Active subsolver for GAP_FILL phases. */
  declare activeSubSolver: GapFillSubSolver | null

  constructor(opts: {
    simpleRouteJson: SimpleRouteJson
    gridOptions?: Partial<GridFill3DOptions>
    gapFillOptions?: Partial<GapFillOptions>
  }) {
    super()
    this.srj = opts.simpleRouteJson
    this.gridOptions = opts.gridOptions ?? {}
    this.gapFillOptions = opts.gapFillOptions ?? {}
    this.activeSubSolver = null
  }

  override _setup() {
    this.state = initState(this.srj, this.gridOptions)
    this.stats = {
      phase: this.state.phase,
      gridIndex: this.state.gridIndex,
    }
  }

  /** Exactly ONE small step per call. */
  override _step() {
    if (this.state.phase === "GRID") {
      stepGrid(this.state)
    } else if (this.state.phase === "EXPANSION") {
      stepExpansion(this.state)
    } else if (this.state.phase === "GAP_FILL") {
      // Initialize gap fill subsolver if needed
      if (
        !this.activeSubSolver ||
        !(this.activeSubSolver instanceof GapFillSubSolver)
      ) {
        const minTrace = this.srj.minTraceWidth || 0.15
        const minGapSize = Math.max(0.01, minTrace / 10)
        const boundsSize = Math.min(
          this.state.bounds.width,
          this.state.bounds.height,
        )
        this.activeSubSolver = new GapFillSubSolver({
          placed: this.state.placed,
          options: {
            minWidth: minGapSize,
            minHeight: minGapSize,
            scanResolution: Math.max(0.05, boundsSize / 100),
            ...this.gapFillOptions,
          },
          layerCtx: {
            bounds: this.state.bounds,
            layerCount: this.state.layerCount,
            obstaclesByLayer: this.state.obstaclesByLayer,
            placedByLayer: this.state.placedByLayer,
          },
        })
      }

      this.activeSubSolver.step()

      if (this.activeSubSolver.solved) {
        // Transfer results back to main state
        const output = this.activeSubSolver.getOutput()
        this.state.placed = output.placed
        this.state.placedByLayer = output.placedByLayer
        this.activeSubSolver = null
        this.state.phase = "DONE"
      }
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
    if (this.activeSubSolver instanceof GapFillSubSolver) {
      const output = this.activeSubSolver.getOutput()
      this.stats.gapsFilled = output.filledCount
    }
  }

  /** Compute solver progress (0 to 1). */
  computeProgress(): number {
    if (this.solved || this.state.phase === "DONE") {
      return 1
    }
    if (
      this.state.phase === "GAP_FILL" &&
      this.activeSubSolver instanceof GapFillSubSolver
    ) {
      return 0.85 + 0.1 * this.activeSubSolver.computeProgress()
    }
    return computeProgress(this.state) * 0.85
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    return { meshNodes: this._meshNodes }
  }

  /** Get coverage percentage (0-1). */
  getCoverage(sampleResolution: number = 0.05): number {
    return calculateCoverage(
      { sampleResolution },
      {
        bounds: this.state.bounds,
        layerCount: this.state.layerCount,
        obstaclesByLayer: this.state.obstaclesByLayer,
        placedByLayer: this.state.placedByLayer,
      },
    )
  }

  /** Find uncovered points for debugging gaps. */
  getUncoveredPoints(
    sampleResolution: number = 0.05,
  ): Array<{ x: number; y: number; z: number }> {
    return findUncoveredPoints(
      { sampleResolution },
      {
        bounds: this.state.bounds,
        layerCount: this.state.layerCount,
        obstaclesByLayer: this.state.obstaclesByLayer,
        placedByLayer: this.state.placedByLayer,
      },
    )
  }

  /** Get color based on z layer for visualization. */
  private getColorForZLayer(zLayers: number[]): {
    fill: string
    stroke: string
  } {
    const minZ = Math.min(...zLayers)
    const colors = [
      { fill: "#dbeafe", stroke: "#3b82f6" },
      { fill: "#fef3c7", stroke: "#f59e0b" },
      { fill: "#d1fae5", stroke: "#10b981" },
      { fill: "#e9d5ff", stroke: "#a855f7" },
      { fill: "#fed7aa", stroke: "#f97316" },
      { fill: "#fecaca", stroke: "#ef4444" },
    ]
    return colors[minZ % colors.length]!
  }

  /** Streaming visualization: board + obstacles + current placements. */
  override visualize(): GraphicsObject {
    // If a subsolver is active, delegate to its visualization
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []

    // Board bounds - use srj bounds which is always available
    const boardBounds = {
      minX: this.srj.bounds.minX,
      maxX: this.srj.bounds.maxX,
      minY: this.srj.bounds.minY,
      maxY: this.srj.bounds.maxY,
    }

    // board
    rects.push({
      center: {
        x: (boardBounds.minX + boardBounds.maxX) / 2,
        y: (boardBounds.minY + boardBounds.maxY) / 2,
      },
      width: boardBounds.maxX - boardBounds.minX,
      height: boardBounds.maxY - boardBounds.minY,
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
      title: `RectDiff (${this.state?.phase ?? "init"})`,
      coordinateSystem: "cartesian",
      rects,
      points,
    }
  }
}

// Re-export types for convenience
export type { GridFill3DOptions } from "./rectdiff/types"
