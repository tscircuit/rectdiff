import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type {
  GridFill3DOptions,
  Candidate3D,
  Placed3D,
  XYRect,
} from "../../rectdiff-types"
import { computeInverseRects } from "./computeInverseRects"
import { buildZIndexMap, obstacleToXYRect, obstacleZs } from "./layers"
import { overlaps } from "../../utils/rectdiff-geometry"
import { expandRectFromSeed } from "../../utils/expandRectFromSeed"
import { computeDefaultGridSizes } from "./computeDefaultGridSizes"
import { computeCandidates3D } from "./computeCandidates3D"
import { computeEdgeCandidates3D } from "./computeEdgeCandidates3D"
import { longestFreeSpanAroundZ } from "./longestFreeSpanAroundZ"
import { allLayerNode } from "../../utils/buildHardPlacedByLayer"
import { isFullyOccupiedAtPoint } from "lib/utils/isFullyOccupiedAtPoint"
import { resizeSoftOverlaps } from "../../utils/resizeSoftOverlaps"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"
import RBush from "rbush"
import type { RTreeRect } from "lib/types/capacity-mesh-types"
import { rectToTree } from "lib/utils/rectToTree"

export type RectDiffSeedingSolverInput = {
  simpleRouteJson: SimpleRouteJson
  obstacleIndexByLayer: Array<RBush<RTreeRect>>
  gridOptions?: Partial<GridFill3DOptions>
  boardVoidRects?: XYRect[]
  layerNames: string[]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}

/**
 * First phase of RectDiff: grid-based seeding and placement.
 *
 * This solver is responsible for walking all grid sizes and producing
 * an initial set of placed rectangles.
 */
export class RectDiffSeedingSolver extends BaseSolver {
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
  private boardVoidRects?: XYRect[]
  private gridIndex!: number
  private candidates!: Candidate3D[]
  private placed!: Placed3D[]
  private placedIndexByLayer!: Array<RBush<RTreeRect>>
  private expansionIndex!: number
  private edgeAnalysisDone!: boolean
  private totalSeedsThisGrid!: number
  private consumedSeedsThisGrid!: number

  constructor(private input: RectDiffSeedingSolverInput) {
    super()
  }

  override _setup() {
    const srj = this.input.simpleRouteJson
    const opts = this.input.gridOptions ?? {}

    const precomputed = this.input.layerNames && this.input.zIndexByName
    const { layerNames, zIndexByName } = precomputed
      ? {
          layerNames: this.input.layerNames!,
          zIndexByName: this.input.zIndexByName!,
        }
      : buildZIndexMap({
          obstacles: srj.obstacles,
          layerCount: srj.layerCount,
        })
    const layerCount = Math.max(1, layerNames.length, srj.layerCount || 1)

    const bounds: XYRect = {
      x: srj.bounds.minX,
      y: srj.bounds.minY,
      width: srj.bounds.maxX - srj.bounds.minX,
      height: srj.bounds.maxY - srj.bounds.minY,
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

    this.srj = srj
    this.layerNames = layerNames
    this.layerCount = layerCount
    this.bounds = bounds
    this.options = options
    this.boardVoidRects = this.input.boardVoidRects
    this.gridIndex = 0
    this.candidates = []
    this.placed = []
    this.placedIndexByLayer = Array.from(
      { length: layerCount },
      () => new RBush<RTreeRect>(),
    )
    this.expansionIndex = 0
    this.edgeAnalysisDone = false
    this.totalSeedsThisGrid = 0
    this.consumedSeedsThisGrid = 0

    this.stats = {
      gridIndex: this.gridIndex,
    }
  }

  /** Exactly ONE grid candidate step per call. */
  override _step() {
    this._stepGrid()

    this.stats.gridIndex = this.gridIndex
    this.stats.placed = this.placed.length
  }

  /**
   * One micro-step during the GRID phase: handle exactly one candidate.
   */
  private _stepGrid(): void {
    const {
      gridSizes,
      initialCellRatio,
      maxAspectRatio,
      minSingle,
      minMulti,
      preferMultiLayer,
      maxMultiLayerSpan,
    } = this.options
    const grid = gridSizes[this.gridIndex]!

    // Build hard-placed map once per micro-step (cheap)
    const hardPlacedByLayer = allLayerNode({
      layerCount: this.layerCount,
      placed: this.placed,
    })

    // Ensure candidates exist for this grid
    if (this.candidates.length === 0 && this.consumedSeedsThisGrid === 0) {
      this.candidates = computeCandidates3D({
        bounds: this.bounds,
        gridSize: grid,
        layerCount: this.layerCount,
        hardPlacedByLayer,
        obstacleIndexByLayer: this.input.obstacleIndexByLayer,
        placedIndexByLayer: this.placedIndexByLayer,
      })
      this.totalSeedsThisGrid = this.candidates.length
      this.consumedSeedsThisGrid = 0
    }

    // If no candidates remain, advance grid or run edge pass or switch phase
    if (this.candidates.length === 0) {
      if (this.gridIndex + 1 < gridSizes.length) {
        this.gridIndex += 1
        this.totalSeedsThisGrid = 0
        this.consumedSeedsThisGrid = 0
        return
      } else {
        if (!this.edgeAnalysisDone) {
          const minSize = Math.min(minSingle.width, minSingle.height)
          this.candidates = computeEdgeCandidates3D({
            bounds: this.bounds,
            minSize,
            layerCount: this.layerCount,
            obstacleIndexByLayer: this.input.obstacleIndexByLayer,
            placedIndexByLayer: this.placedIndexByLayer,
            hardPlacedByLayer,
          })
          this.edgeAnalysisDone = true
          this.totalSeedsThisGrid = this.candidates.length
          this.consumedSeedsThisGrid = 0
          return
        }
        this.solved = true
        this.expansionIndex = 0
        return
      }
    }

    // Consume exactly one candidate
    const cand = this.candidates.shift()!
    this.consumedSeedsThisGrid += 1

    // Evaluate attempts — multi-layer span first (computed ignoring soft nodes)
    const span = longestFreeSpanAroundZ({
      x: cand.x,
      y: cand.y,
      z: cand.z,
      layerCount: this.layerCount,
      minSpan: minMulti.minLayers,
      maxSpan: maxMultiLayerSpan,
      obstacleIndexByLayer: this.input.obstacleIndexByLayer,
      additionalBlockersByLayer: hardPlacedByLayer,
    })

    const attempts: Array<{
      kind: "multi" | "single"
      layers: number[]
      minReq: { width: number; height: number }
    }> = []

    if (span.length >= minMulti.minLayers) {
      attempts.push({
        kind: "multi",
        layers: span,
        minReq: { width: minMulti.width, height: minMulti.height },
      })
    }
    attempts.push({
      kind: "single",
      layers: [cand.z],
      minReq: { width: minSingle.width, height: minSingle.height },
    })

    const ordered = preferMultiLayer ? attempts : attempts.reverse()

    for (const attempt of ordered) {
      const rect = expandRectFromSeed({
        startX: cand.x,
        startY: cand.y,
        gridSize: grid,
        bounds: this.bounds,
        obsticalIndexByLayer: this.input.obstacleIndexByLayer,
        placedIndexByLayer: this.placedIndexByLayer,
        initialCellRatio,
        maxAspectRatio,
        minReq: attempt.minReq,
        zLayers: attempt.layers,
      })
      if (!rect) continue

      // Place the new node
      const placed: Placed3D = { rect, zLayers: [...attempt.layers] }
      const newIndex = this.placed.push(placed) - 1
      for (const z of attempt.layers) {
        const idx = this.placedIndexByLayer[z]
        if (idx) {
          idx.insert(rectToTree(rect, { zLayers: placed.zLayers }))
        }
      }

      // New: carve overlapped soft nodes
      resizeSoftOverlaps(
        {
          layerCount: this.layerCount,
          placed: this.placed,
          options: this.options,
          placedIndexByLayer: this.placedIndexByLayer,
        },
        newIndex,
      )

      // New: relax candidate culling — only drop seeds that became fully occupied
      this.candidates = this.candidates.filter(
        (c) =>
          !isFullyOccupiedAtPoint({
            layerCount: this.layerCount,
            obstacleIndexByLayer: this.input.obstacleIndexByLayer,
            placedIndexByLayer: this.placedIndexByLayer,
            point: { x: c.x, y: c.y },
          }),
      )

      return // processed one candidate
    }

    // Neither attempt worked; drop this candidate for now.
  }

  /** Compute solver progress (0 to 1) during GRID phase. */
  computeProgress(): number {
    if (this.solved) {
      return 1
    }
    const grids = this.options.gridSizes.length
    const g = this.gridIndex
    const base = g / (grids + 1) // reserve final slice for expansion
    const denom = Math.max(1, this.totalSeedsThisGrid)
    const frac = denom ? this.consumedSeedsThisGrid / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }

  /**
   * Output the intermediate RectDiff engine data to feed into the
   * expansion phase solver.
   */
  override getOutput() {
    return {
      layerNames: this.layerNames,
      layerCount: this.layerCount,
      bounds: this.bounds,
      options: this.options,
      boardVoidRects: this.boardVoidRects,
      gridIndex: this.gridIndex,
      candidates: this.candidates,
      placed: this.placed,
      expansionIndex: this.expansionIndex,
      edgeAnalysisDone: this.edgeAnalysisDone,
      totalSeedsThisGrid: this.totalSeedsThisGrid,
      consumedSeedsThisGrid: this.consumedSeedsThisGrid,
      obstacles: this.srj.obstacles,
      obstacleClearance: this.input.obstacleClearance,
    }
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
          label: `z:${cand.z}`,
        })
      }
    }

    // current placements (streaming) during grid fill
    if (this.placed?.length) {
      for (const placement of this.placed) {
        const colors = getColorForZLayer(placement.zLayers)
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
      title: "RectDiff Grid",
      coordinateSystem: "cartesian",
      rects,
      points,
      lines,
    }
  }
}
