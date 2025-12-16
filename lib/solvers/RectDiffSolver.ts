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
import { overlaps } from "./rectdiff/geometry"
import type { GapFillOptions } from "./rectdiff/gapfill/types"
import {
  findUncoveredPoints,
  calculateCoverage,
} from "./rectdiff/gapfill/engine"
import { EdgeExpansionGapFillSubSolver } from "./rectdiff/subsolvers/EdgeExpansionGapFillSubSolver"

/**
 * A streaming, one-step-per-iteration solver for capacity mesh generation.
 */
export class RectDiffSolver extends BaseSolver {
  private srj: SimpleRouteJson
  private gridOptions: Partial<GridFill3DOptions>
  private state!: RectDiffState
  private _meshNodes: CapacityMeshNode[] = []
  private gapFillSubSolver?: EdgeExpansionGapFillSubSolver

  constructor(opts: {
    simpleRouteJson: SimpleRouteJson
    gridOptions?: Partial<GridFill3DOptions>
  }) {
    super()
    this.srj = opts.simpleRouteJson
    this.gridOptions = opts.gridOptions ?? {}
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
      // Initialize gap fill subsolver on first entry
      if (!this.gapFillSubSolver) {
        this.gapFillSubSolver = new EdgeExpansionGapFillSubSolver({
          bounds: this.state.bounds,
          layerCount: this.state.layerCount,
          obstacles: this.state.obstaclesByLayer,
          existingPlaced: this.state.placed,
          existingPlacedByLayer: this.state.placedByLayer,
          options: {
            minSingle: this.state.options.minSingle,
            minMulti: this.state.options.minMulti,
            maxAspectRatio: this.state.options.maxAspectRatio,
            maxMultiLayerSpan: this.state.options.maxMultiLayerSpan,
          },
        })
      }

      // Step the subsolver
      if (!this.gapFillSubSolver.solved) {
        this.gapFillSubSolver.step()
      } else {
        // Merge gap-fill results into main state
        const gapFillOutput = this.gapFillSubSolver.getOutput()
        this.state.placed.push(...gapFillOutput.newPlaced)

        // Update placedByLayer
        for (const placed of gapFillOutput.newPlaced) {
          for (const z of placed.zLayers) {
            if (!this.state.placedByLayer[z]) {
              this.state.placedByLayer[z] = []
            }
            this.state.placedByLayer[z]!.push(placed.rect)
          }
        }

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
  }

  /** Compute solver progress (0 to 1). */
  computeProgress(): number {
    if (this.solved || this.state.phase === "DONE") {
      return 1
    }

    const baseProgress = computeProgress(this.state)

    // If in GAP_FILL phase, factor in subsolver progress
    if (this.state.phase === "GAP_FILL" && this.gapFillSubSolver) {
      const gapFillProgress = this.gapFillSubSolver.computeProgress()
      // GAP_FILL is the last phase before DONE, so weight it appropriately
      // Assume GRID+EXPANSION is 90%, GAP_FILL is remaining 10%
      return 0.9 + gapFillProgress * 0.1
    }

    return baseProgress * 0.9 // Scale down to leave room for GAP_FILL
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
    // If in GAP_FILL phase, delegate to subsolver visualization
    if (this.state?.phase === "GAP_FILL" && this.gapFillSubSolver) {
      return this.gapFillSubSolver.visualize()
    }

    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []
    const lines: NonNullable<GraphicsObject["lines"]> = [] // Initialize lines array

    // Board bounds - use srj bounds which is always available
    const boardBounds = {
      minX: this.srj.bounds.minX,
      maxX: this.srj.bounds.maxX,
      minY: this.srj.bounds.minY,
      maxY: this.srj.bounds.maxY,
    }

    // board or outline
    if (this.srj.outline && this.srj.outline.length > 1) {
      lines.push({
        points: [...this.srj.outline, this.srj.outline[0]!], // Close the loop by adding the first point again
        strokeColor: "#111827",
        strokeWidth: 0.01,
        label: "outline",
      })
    } else {
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
    }

    // obstacles (rect & oval as bounding boxes) with layer information
    for (const obstacle of this.srj.obstacles ?? []) {
      if (obstacle.type === "rect" || obstacle.type === "oval") {
        // Get layer information if available
        const layerInfo =
          obstacle.layers && obstacle.layers.length > 0
            ? `\nz:${obstacle.layers.join(",")}`
            : ""

        rects.push({
          center: { x: obstacle.center.x, y: obstacle.center.y },
          width: obstacle.width,
          height: obstacle.height,
          fill: "#fee2e2",
          stroke: "#ef4444",
          layer: "obstacle",
          label: `obstacle ${layerInfo}`,
        })
      }
    }

    // board void rects
    if (this.state?.boardVoidRects) {
      // If outline exists, compute its bbox to hide outer padding voids
      let outlineBBox: {
        x: number
        y: number
        width: number
        height: number
      } | null = null

      if (this.srj.outline && this.srj.outline.length > 0) {
        const xs = this.srj.outline.map((p) => p.x)
        const ys = this.srj.outline.map((p) => p.y)
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        outlineBBox = {
          x: minX,
          y: minY,
          width: Math.max(...xs) - minX,
          height: Math.max(...ys) - minY,
        }
      }

      for (const r of this.state.boardVoidRects) {
        // If we have an outline, only show voids that overlap its bbox (hides outer padding)
        if (outlineBBox && !overlaps(r, outlineBBox)) {
          continue
        }

        rects.push({
          center: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
          width: r.width,
          height: r.height,
          fill: "rgba(0, 0, 0, 0.5)",
          stroke: "none",
          label: "void",
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
      lines, // Include lines in the returned GraphicsObject
    }
  }
}

// Re-export types for convenience
export type { GridFill3DOptions } from "./rectdiff/types"
