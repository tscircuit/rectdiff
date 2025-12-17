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
import {
  findUncoveredPoints,
  calculateCoverage,
} from "./rectdiff/gapfill/engine"
import {
  initEdgeGapFillState,
  stepEdgeGapFill,
} from "./rectdiff/gapfill-edge/engine"
import type { EdgeGapFillState } from "./rectdiff/gapfill-edge/types"
import { BasePipelineSolver } from "./BasePipelineSolver"

/**
 * A streaming, one-step-per-iteration solver for capacity mesh generation.
 */
export class RectDiffSolver extends BasePipelineSolver {
  private srj: SimpleRouteJson
  private gridOptions: Partial<GridFill3DOptions>
  private state!: RectDiffState
  private _meshNodes: CapacityMeshNode[] = []
  private gapFillState: EdgeGapFillState | null = null

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

  protected getCurrentPhase(): string | null {
    if (!this.state) {
      return null
    }
    return this.state.phase === "DONE" ? null : this.state.phase
  }

  protected setPhase(phase: string | null): void {
    if (!this.state) {
      return
    }
    if (phase === null) {
      this.state.phase = "DONE"
      // Finalize once when done
      if (!this.solved) {
        const rects = finalizeRects(this.state)
        this._meshNodes = rectsToMeshNodes(rects)
        this.solved = true
      }
    } else {
      this.state.phase = phase as RectDiffState["phase"]
    }
  }

  protected stepPhase(phase: string): string | null {
    if (!this.state) {
      return null
    }
    if (phase === "GRID") {
      stepGrid(this.state)
      return this.state.phase
    } else if (phase === "EXPANSION") {
      stepExpansion(this.state)
      return this.state.phase
    } else if (phase === "GAP_FILL") {
      // Initialize gap fill state if needed
      if (!this.gapFillState) {
        this.gapFillState = initEdgeGapFillState(this.state)
      }

      // Step the gap fill algorithm
      const stillWorking = stepEdgeGapFill(this.gapFillState, this.state)
      if (!stillWorking) {
        return "DONE"
      }
      return "GAP_FILL"
    }
    return null
  }

  override _step() {
    super._step()
    // Lightweight stats for debugger
    if (this.state) {
      this.stats.phase = this.state.phase
      this.stats.gridIndex = this.state.gridIndex
      this.stats.placed = this.state.placed.length
    }
  }

  /** Compute solver progress (0 to 1). */
  computeProgress(): number {
    if (this.solved || this.state.phase === "DONE") {
      return 1
    }
    return computeProgress(this.state)
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

    // obstacles (rect & oval as bounding boxes)
    for (const obstacle of this.srj.obstacles ?? []) {
      if (obstacle.type === "rect" || obstacle.type === "oval") {
        rects.push({
          center: { x: obstacle.center.x, y: obstacle.center.y },
          width: obstacle.width,
          height: obstacle.height,
          fill: "#fee2e2",
          stroke: "#ef4444",
          layer: "obstacle",
          label: "obstacle",
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

    // Gap fill visualization - extremely granular
    if (this.state?.phase === "GAP_FILL" && this.gapFillState) {
      const gf = this.gapFillState

      // Highlight primary edge (thick, bright red) - shown in all stages after SELECT_EDGE
      if (gf.primaryEdge && gf.stage !== "SELECT_EDGE") {
        lines.push({
          points: [gf.primaryEdge.start, gf.primaryEdge.end],
          strokeColor: "#ef4444",
          strokeWidth: 0.08,
          label: "PRIMARY EDGE",
        })
      }

      // Highlight nearby edges (orange) - shown in FIND_SEGMENTS, GENERATE_POINTS, EXPAND_FROM_POINT
      if (
        gf.stage === "FIND_SEGMENTS" ||
        gf.stage === "GENERATE_POINTS" ||
        gf.stage === "EXPAND_FROM_POINT"
      ) {
        for (const edge of gf.nearbyEdges) {
          lines.push({
            points: [edge.start, edge.end],
            strokeColor: "#f59e0b",
            strokeWidth: 0.04,
            label: "nearby",
          })
        }
      }

      // Highlight unoccupied segments (green) - shown in GENERATE_POINTS and EXPAND_FROM_POINT
      if (
        gf.primaryEdge &&
        (gf.stage === "GENERATE_POINTS" || gf.stage === "EXPAND_FROM_POINT") &&
        gf.unoccupiedSegments.length > 0
      ) {
        for (const segment of gf.unoccupiedSegments) {
          let start: { x: number; y: number }
          let end: { x: number; y: number }

          if (gf.primaryEdge.orientation === "horizontal") {
            start = { x: segment.start, y: gf.primaryEdge.start.y }
            end = { x: segment.end, y: gf.primaryEdge.start.y }
          } else {
            start = { x: gf.primaryEdge.start.x, y: segment.start }
            end = { x: gf.primaryEdge.start.x, y: segment.end }
          }

          lines.push({
            points: [start, end],
            strokeColor: "#10b981",
            strokeWidth: 0.06,
            label: "unoccupied",
          })
        }
      }

      // Show expansion points (blue) - shown in EXPAND_FROM_POINT
      if (gf.stage === "EXPAND_FROM_POINT") {
        for (let i = 0; i < gf.expansionPoints.length; i++) {
          const point = gf.expansionPoints[i]!
          const isCurrent = i === gf.expansionPointIndex
          points.push({
            x: point.x,
            y: point.y,
            fill: isCurrent ? "#dc2626" : "#3b82f6",
            stroke: isCurrent ? "#991b1b" : "#1e40af",
            label: isCurrent
              ? `EXPANDING\nz:${point.zLayers.join(",")}`
              : `point\nz:${point.zLayers.join(",")}`,
          } as any)
        }

        // Show currently expanding rectangle (yellow)
        if (gf.currentExpandingRect) {
          rects.push({
            center: {
              x: gf.currentExpandingRect.x + gf.currentExpandingRect.width / 2,
              y: gf.currentExpandingRect.y + gf.currentExpandingRect.height / 2,
            },
            width: gf.currentExpandingRect.width,
            height: gf.currentExpandingRect.height,
            fill: "#fef3c7",
            stroke: "#f59e0b",
            label: "expanding",
          })
        }
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

    let phaseTitle = `RectDiff (${this.state?.phase ?? "init"})`
    if (this.state?.phase === "GAP_FILL" && this.gapFillState) {
      const gf = this.gapFillState
      const stageLabels: Record<string, string> = {
        SELECT_EDGE: "Selecting Edge",
        FIND_NEARBY: "Finding Nearby",
        FIND_SEGMENTS: "Finding Segments",
        GENERATE_POINTS: "Generating Points",
        EXPAND_FROM_POINT: "Expanding",
        DONE: "Done",
      }
      phaseTitle = `GapFill: ${stageLabels[gf.stage] ?? gf.stage} (edge ${gf.edgeIndex + 1}/${gf.allEdges.length}${
        gf.expansionPoints.length > 0
          ? `, point ${gf.expansionPointIndex + 1}/${gf.expansionPoints.length}`
          : ""
      })`
    }

    return {
      title: phaseTitle,
      coordinateSystem: "cartesian",
      rects,
      points,
      lines, // Include lines in the returned GraphicsObject
    }
  }
}

// Re-export types for convenience
export type { GridFill3DOptions } from "./rectdiff/types"
