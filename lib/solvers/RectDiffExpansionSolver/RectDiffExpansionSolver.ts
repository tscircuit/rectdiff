import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode, RTreeRect } from "lib/types/capacity-mesh-types"
import { expandRectFromSeed } from "../../utils/expandRectFromSeed"
import { finalizeRects } from "../../utils/finalizeRects"
import { allLayerNode } from "../../utils/buildHardPlacedByLayer"
import { resizeSoftOverlaps } from "../../utils/resizeSoftOverlaps"
import { rectsToMeshNodes } from "./rectsToMeshNodes"
import type { XYRect, Candidate3D, Placed3D } from "../../rectdiff-types"
import type { SimpleRouteJson } from "lib/types/srj-types"
import {
  buildZIndexMap,
  obstacleToXYRect,
  obstacleZs,
} from "../RectDiffSeedingSolver/layers"
import RBush from "rbush"
import { rectToTree } from "../../utils/rectToTree"
import { sameTreeRect } from "../../utils/sameTreeRect"
import { ensureBoardVoidRectsInObstacleIndex } from "lib/utils/ensureBoardVoidRectsInObstacleIndex"

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
  boardVoidRects: XYRect[]
  gridIndex: number
  candidates: Candidate3D[]
  placed: Placed3D[]
  expansionIndex: number
  edgeAnalysisDone: boolean
  totalSeedsThisGrid: number
  consumedSeedsThisGrid: number
}

export type RectDiffExpansionSolverInput = {
  initialSnapshot: RectDiffExpansionSolverSnapshot
  obstacleIndexByLayer: Array<RBush<RTreeRect>>
}

/**
 * Second phase of RectDiff: expand placed rects to their maximal extents.
 *
 * This solver takes the intermediate data produced by RectDiffSeedingSolver
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
  private boardVoidRects!: XYRect[]
  private gridIndex!: number
  private candidates!: Candidate3D[]
  private placed!: Placed3D[]
  private placedIndexByLayer!: Array<RBush<RTreeRect>>
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

    if (this.input.obstacleIndexByLayer) {
    } else {
      const { zIndexByName } = buildZIndexMap(this.srj)
      this.input.obstacleIndexByLayer = Array.from(
        { length: this.layerCount },
        () => new RBush<RTreeRect>(),
      )
      const insertObstacle = (rect: XYRect, z: number) => {
        const tree = this.input.obstacleIndexByLayer[z]
        if (tree) tree.insert(rectToTree(rect))
      }
      for (const voidRect of this.boardVoidRects ?? []) {
        for (let z = 0; z < this.layerCount; z++) insertObstacle(voidRect, z)
      }
      for (const obstacle of this.srj.obstacles ?? []) {
        const rect = obstacleToXYRect(obstacle as any)
        if (!rect) continue
        const zLayers =
          obstacle.zLayers?.length && obstacle.zLayers.length > 0
            ? obstacle.zLayers
            : obstacleZs(obstacle as any, zIndexByName)
        zLayers.forEach((z) => {
          if (z >= 0 && z < this.layerCount) insertObstacle(rect, z)
        })
      }
    }
    this.input.obstacleIndexByLayer = ensureBoardVoidRectsInObstacleIndex(
      this.boardVoidRects,
      this.input.obstacleIndexByLayer,
    )

    this.placedIndexByLayer = Array.from(
      { length: this.layerCount },
      () => new RBush<RTreeRect>(),
    )
    for (const placement of this.placed ?? []) {
      for (const z of placement.zLayers) {
        const tree = this.placedIndexByLayer[z]
        if (tree) tree.insert(rectToTree(placement.rect))
      }
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

    const hardPlacedByLayer = allLayerNode({
      layerCount: this.layerCount,
      placed: this.placed,
    })

    // HARD blockers only: obstacles on p.zLayers + full-stack nodes
    const hardBlockers: XYRect[] = []
    for (const z of p.zLayers) {
      const obstacleTree = this.input.obstacleIndexByLayer[z]
      if (obstacleTree) hardBlockers.push(...obstacleTree.all())
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
        const tree = this.placedIndexByLayer[z]
        if (tree) {
          tree.remove(rectToTree(oldRect), sameTreeRect)
          tree.insert(rectToTree(expanded))
        }
      }

      // Carve overlapped soft neighbors (respect full-stack nodes)
      resizeSoftOverlaps(
        {
          layerCount: this.layerCount,
          placed: this.placed,
          options: this.options,
          placedIndexByLayer: this.placedIndexByLayer,
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
      srj: this.srj,
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
