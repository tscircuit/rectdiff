import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type {
  GridFill3DOptions,
  Candidate3D,
  Placed3D,
  XYRect,
  Phase,
} from "../rectdiff/types"
import { stepGrid, computeProgress } from "../rectdiff/engine"
import { computeInverseRects } from "../rectdiff/geometry/computeInverseRects"
import {
  buildZIndexMap,
  obstacleToXYRect,
  obstacleZs,
} from "../rectdiff/layers"
import { overlaps } from "../rectdiff/geometry"
import { computeDefaultGridSizes } from "../rectdiff/candidates"

export type RectDiffGridSolverInput = {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

/**
 * First phase of RectDiff: grid-based seeding and placement.
 *
 * This solver is responsible for walking all grid sizes and producing
 * an initial set of placed rectangles. It stops once the phase
 * transitions away from "GRID" (i.e. when EXPANSION should begin).
 */
export class RectDiffGridSolver extends BaseSolver {
  // Engine fields (mirrors initState / engine.ts)

  private srj!: SimpleRouteJson
  private layerNames!: string[]
  private layerCount!: number
  private bounds!: XYRect
  private options!: Required<
    Omit<GridFill3DOptions, "gridSizes" | "maxMultiLayerSpan">
  > & {
    gridSizes: number[]
    maxMultiLayerSpan: number | undefined
  }
  private obstaclesByLayer!: XYRect[][]
  private boardVoidRects!: XYRect[]
  private phase!: Phase
  private gridIndex!: number
  private candidates!: Candidate3D[]
  private placed!: Placed3D[]
  private placedByLayer!: XYRect[][]
  private expansionIndex!: number
  private edgeAnalysisDone!: boolean
  private totalSeedsThisGrid!: number
  private consumedSeedsThisGrid!: number

  constructor(private input: RectDiffGridSolverInput) {
    super()
  }

  override _setup() {
    const srj = this.input.simpleRouteJson
    const opts = this.input.gridOptions ?? {}

    const { layerNames, zIndexByName } = buildZIndexMap(srj)
    const layerCount = Math.max(1, layerNames.length, srj.layerCount || 1)

    const bounds: XYRect = {
      x: srj.bounds.minX,
      y: srj.bounds.minY,
      width: srj.bounds.maxX - srj.bounds.minX,
      height: srj.bounds.maxY - srj.bounds.minY,
    }

    const obstaclesByLayer: XYRect[][] = Array.from(
      { length: layerCount },
      () => [],
    )

    let boardVoidRects: XYRect[] = []
    if (srj.outline && srj.outline.length > 2) {
      boardVoidRects = computeInverseRects(bounds, srj.outline as any)
      for (const voidR of boardVoidRects) {
        for (let z = 0; z < layerCount; z++) {
          obstaclesByLayer[z]!.push(voidR)
        }
      }
    }

    for (const obstacle of srj.obstacles ?? []) {
      const rect = obstacleToXYRect(obstacle as any)
      if (!rect) continue
      const zLayers = obstacleZs(obstacle as any, zIndexByName)
      const invalidZs = zLayers.filter((z) => z < 0 || z >= layerCount)
      if (invalidZs.length) {
        throw new Error(
          `RectDiff: obstacle uses z-layer indices ${invalidZs.join(",")} outside 0-${
            layerCount - 1
          }`,
        )
      }
      if (
        (!obstacle.zLayers || obstacle.zLayers.length === 0) &&
        zLayers.length
      ) {
        obstacle.zLayers = zLayers
      }
      for (const z of zLayers) obstaclesByLayer[z]!.push(rect)
    }

    const trace = Math.max(0.01, srj.minTraceWidth || 0.15)
    const defaults: Required<
      Omit<GridFill3DOptions, "gridSizes" | "maxMultiLayerSpan">
    > & {
      gridSizes: number[]
      maxMultiLayerSpan: number | undefined
    } = {
      gridSizes: [],
      initialCellRatio: 0.2,
      maxAspectRatio: 3,
      minSingle: { width: 2 * trace, height: 2 * trace },
      minMulti: {
        width: 4 * trace,
        height: 4 * trace,
        minLayers: Math.min(2, Math.max(1, srj.layerCount || 1)),
      },
      preferMultiLayer: true,
      maxMultiLayerSpan: undefined,
    }

    const options = {
      ...defaults,
      ...opts,
      gridSizes:
        (opts.gridSizes as number[] | undefined) ??
        // re-use the helper that was previously in engine
        computeDefaultGridSizes(bounds),
    }

    const placedByLayer: XYRect[][] = Array.from(
      { length: layerCount },
      () => [],
    )

    this.srj = srj
    this.layerNames = layerNames
    this.layerCount = layerCount
    this.bounds = bounds
    this.options = options
    this.obstaclesByLayer = obstaclesByLayer
    this.boardVoidRects = boardVoidRects
    this.phase = "GRID"
    this.gridIndex = 0
    this.candidates = []
    this.placed = []
    this.placedByLayer = placedByLayer
    this.expansionIndex = 0
    this.edgeAnalysisDone = false
    this.totalSeedsThisGrid = 0
    this.consumedSeedsThisGrid = 0

    this.stats = {
      phase: this.phase,
      gridIndex: this.gridIndex,
    }
  }

  /** Exactly ONE grid candidate step per call. */
  override _step() {
    if (this.phase !== "GRID") {
      this.solved = true
      return
    }

    stepGrid(this as any)

    this.stats.phase = this.phase
    this.stats.gridIndex = this.gridIndex
    this.stats.placed = this.placed.length

    if (this.phase !== "GRID") {
      this.solved = true
    }
  }

  /** Compute solver progress (0 to 1) during GRID phase. */
  computeProgress(): number {
    if (this.solved || this.phase !== "GRID") {
      return 1
    }
    return computeProgress(this as any)
  }

  /**
   * Output the intermediate RectDiff engine data to feed into the
   * expansion phase solver.
   */
  override getOutput() {
    return {
      srj: this.srj,
      layerNames: this.layerNames,
      layerCount: this.layerCount,
      bounds: this.bounds,
      options: this.options,
      obstaclesByLayer: this.obstaclesByLayer,
      boardVoidRects: this.boardVoidRects,
      phase: this.phase,
      gridIndex: this.gridIndex,
      candidates: this.candidates,
      placed: this.placed,
      placedByLayer: this.placedByLayer,
      expansionIndex: this.expansionIndex,
      edgeAnalysisDone: this.edgeAnalysisDone,
      totalSeedsThisGrid: this.totalSeedsThisGrid,
      consumedSeedsThisGrid: this.consumedSeedsThisGrid,
    }
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
    ] as const
    return colors[minZ % colors.length]!
  }

  /** Visualization focused on the grid seeding phase. */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []
    const lines: NonNullable<GraphicsObject["lines"]> = []

    const srj = this.srj ?? this.input.simpleRouteJson

    // Board bounds - use srj bounds which is always available
    const boardBounds = {
      minX: srj.bounds.minX,
      maxX: srj.bounds.maxX,
      minY: srj.bounds.minY,
      maxY: srj.bounds.maxY,
    }

    // board or outline
    if (srj.outline && srj.outline.length > 1) {
      lines.push({
        points: [...srj.outline, srj.outline[0] as { x: number; y: number }],
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
    for (const obstacle of srj.obstacles ?? []) {
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

    // board void rects (early visualization of mask)
    if (this.boardVoidRects) {
      let outlineBBox: {
        x: number
        y: number
        width: number
        height: number
      } | null = null

      if (srj.outline && srj.outline.length > 0) {
        const xs = srj.outline.map((p: { x: number; y: number }) => p.x)
        const ys = srj.outline.map((p: { x: number; y: number }) => p.y)
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        outlineBBox = {
          x: minX,
          y: minY,
          width: Math.max(...xs) - minX,
          height: Math.max(...ys) - minY,
        }
      }

      for (const r of this.boardVoidRects) {
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

    // candidate positions (where expansion will later start from)
    if (this.candidates?.length) {
      for (const cand of this.candidates) {
        points.push({
          x: cand.x,
          y: cand.y,
          fill: "#9333ea",
          stroke: "#6b21a8",
          label: `z:${cand.z}`,
        } as any)
      }
    }

    // current placements (streaming) during grid fill
    if (this.placed?.length) {
      for (const placement of this.placed) {
        const colors = this.getColorForZLayer(placement.zLayers)
        rects.push({
          center: {
            x: placement.rect.x + placement.rect.width / 2,
            y: placement.rect.y + placement.rect.height / 2,
          },
          width: placement.rect.width,
          height: placement.rect.height,
          fill: colors.fill,
          stroke: colors.stroke,
          layer: `z${placement.zLayers.join(",")}`,
          label: `free\nz:${placement.zLayers.join(",")}`,
        })
      }
    }

    return {
      title: `RectDiff Grid (${this.phase ?? "init"})`,
      coordinateSystem: "cartesian",
      rects,
      points,
      lines,
    }
  }
}
