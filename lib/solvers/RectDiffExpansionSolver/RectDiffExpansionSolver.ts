import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { expandRectFromSeed } from "../../utils/rectdiff-geometry"
import { finalizeRects } from "../../utils/finalizeRects"
import { buildHardPlacedByLayer } from "../../utils/buildHardPlacedByLayer"
import { resizeSoftOverlaps } from "../../utils/resizeSoftOverlaps"
import { rectsToMeshNodes } from "./rectsToMeshNodes"
import type { XYRect, Candidate3D, Placed3D } from "../../rectdiff-types"
import type { SimpleRouteJson } from "../../types/srj-types"

export type RectDiffExpansionSolverSnapshot = {
  srj: SimpleRouteJson
  layerNames: string[]
  layerCount: number
  bounds: XYRect
  options: {
    gridSizes: number[]
    // the engine only uses gridSizes here, other options are ignored
    [key: string]: any
  }
  obstaclesByLayer: XYRect[][]
  boardVoidRects: XYRect[]
  gridIndex: number
  candidates: Candidate3D[]
  placed: Placed3D[]
  placedByLayer: XYRect[][]
  expansionIndex: number
  edgeAnalysisDone: boolean
  totalSeedsThisGrid: number
  consumedSeedsThisGrid: number
}

export type RectDiffExpansionSolverInput = {
  initialSnapshot: RectDiffExpansionSolverSnapshot
}

/**
 * Second phase of RectDiff: expand placed rects to their maximal extents.
 *
 * This solver takes the intermediate data produced by RectDiffGridSolver
 * and runs the EXPANSION phase, then finalizes to capacity mesh nodes.
 */
export class RectDiffExpansionSolver extends BaseSolver {
  // Engine fields (same shape used by rectdiff/engine.ts)
  private srj!: SimpleRouteJson
  private layerNames!: string[]
  private layerCount!: number
  private bounds!: XYRect
  private options!: {
    gridSizes: number[]
    // the engine only uses gridSizes here, other options are ignored
    [key: string]: any
  }
  private obstaclesByLayer!: XYRect[][]
  private boardVoidRects!: XYRect[]
  private gridIndex!: number
  private candidates!: Candidate3D[]
  private placed!: Placed3D[]
  private placedByLayer!: XYRect[][]
  private expansionIndex!: number
  private edgeAnalysisDone!: boolean
  private totalSeedsThisGrid!: number
  private consumedSeedsThisGrid!: number

  private _meshNodes: CapacityMeshNode[] = []

  constructor(private input: RectDiffExpansionSolverInput) {
    super()
    // Copy engine snapshot fields directly onto this solver instance
    Object.assign(this, this.input.initialSnapshot)
  }

  override _setup() {
    this.stats = {
      gridIndex: this.gridIndex,
    }
  }

  override _step() {
    if (this.solved) return

    this._stepExpansion()

    this.stats.gridIndex = this.gridIndex
    this.stats.placed = this.placed.length

    if (this.expansionIndex >= this.placed.length) {
      this.finalizeIfNeeded()
    }
  }

  private _stepExpansion(): void {
    if (this.expansionIndex >= this.placed.length) {
      return
    }

    const idx = this.expansionIndex
    const p = this.placed[idx]!
    const lastGrid = this.options.gridSizes[this.options.gridSizes.length - 1]!

    const hardPlacedByLayer = buildHardPlacedByLayer({
      layerCount: this.layerCount,
      placed: this.placed,
    })

    // HARD blockers only: obstacles on p.zLayers + full-stack nodes
    const hardBlockers: XYRect[] = []
    for (const z of p.zLayers) {
      hardBlockers.push(...(this.obstaclesByLayer[z] ?? []))
      hardBlockers.push(...(hardPlacedByLayer[z] ?? []))
    }

    const oldRect = p.rect
    const expanded = expandRectFromSeed({
      startX: p.rect.x + p.rect.width / 2,
      startY: p.rect.y + p.rect.height / 2,
      gridSize: lastGrid,
      bounds: this.bounds,
      blockers: hardBlockers,
      initialCellRatio: 0,
      maxAspectRatio: null,
      minReq: { width: p.rect.width, height: p.rect.height },
    })

    if (expanded) {
      // Update placement + per-layer index (replace old rect object)
      this.placed[idx] = { rect: expanded, zLayers: p.zLayers }
      for (const z of p.zLayers) {
        const arr = this.placedByLayer[z]!
        const j = arr.findIndex((r) => r === oldRect)
        if (j >= 0) arr[j] = expanded
      }

      // Carve overlapped soft neighbors (respect full-stack nodes)
      resizeSoftOverlaps(
        {
          layerCount: this.layerCount,
          placed: this.placed,
          placedByLayer: this.placedByLayer,
          options: this.options,
        },
        idx,
      )
    }

    this.expansionIndex += 1
  }

  private finalizeIfNeeded() {
    if (this.solved) return

    const rects = finalizeRects({
      placed: this.placed,
      obstaclesByLayer: this.obstaclesByLayer,
      boardVoidRects: this.boardVoidRects,
    })
    this._meshNodes = rectsToMeshNodes(rects)
    this.solved = true
  }

  computeProgress(): number {
    if (this.solved) return 1
    const grids = this.options.gridSizes.length
    const base = grids / (grids + 1)
    const denom = Math.max(1, this.placed.length)
    const frac = denom ? this.expansionIndex / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    if (!this.solved && this._meshNodes.length === 0) {
      this.finalizeIfNeeded()
    }
    return { meshNodes: this._meshNodes }
  }

  /** Simple visualization of expanded placements. */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []

    for (const placement of this.placed ?? []) {
      rects.push({
        center: {
          x: placement.rect.x + placement.rect.width / 2,
          y: placement.rect.y + placement.rect.height / 2,
        },
        width: placement.rect.width,
        height: placement.rect.height,
        stroke: "rgba(37, 99, 235, 0.9)",
        fill: "rgba(191, 219, 254, 0.5)",
        layer: `z${placement.zLayers.join(",")}`,
        label: `expanded\nz:${placement.zLayers.join(",")}`,
      })
    }

    return {
      title: "RectDiff Expansion",
      coordinateSystem: "cartesian",
      rects,
      points: [],
      lines: [],
    }
  }
}
