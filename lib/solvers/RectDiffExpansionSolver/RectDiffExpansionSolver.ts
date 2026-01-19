import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode, RTreeRect } from "lib/types/capacity-mesh-types"
import { expandRectFromSeed } from "../../utils/expandRectFromSeed"
import { finalizeRects } from "../../utils/finalizeRects"
import { resizeSoftOverlaps } from "../../utils/resizeSoftOverlaps"
import { rectsToMeshNodes } from "./rectsToMeshNodes"
import type { XYRect, Candidate3D, Placed3D } from "../../rectdiff-types"
import type { Obstacle } from "lib/types/srj-types"
import RBush from "rbush"
import { rectToTree } from "../../utils/rectToTree"
import { sameTreeRect } from "../../utils/sameTreeRect"

export type RectDiffExpansionSolverInput = {
  layerNames: string[]
  layerCount: number
  bounds: XYRect
  options: {
    gridSizes: number[]
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
  obstacleIndexByLayer: Array<RBush<RTreeRect>>
  zIndexByName: Map<string, number>
  layerNamesCanonical: string[]
  obstacles: Obstacle[]
}

/**
 * Second phase of RectDiff: expand placed rects to their maximal extents.
 *
 * This solver takes the intermediate data produced by RectDiffSeedingSolver
 * and runs the EXPANSION phase, then finalizes to capacity mesh nodes.
 */
export class RectDiffExpansionSolver extends BaseSolver {
  placedIndexByLayer: Array<RBush<RTreeRect>> = []
  _meshNodes: CapacityMeshNode[] = []
  constructor(private input: RectDiffExpansionSolverInput) {
    super()
  }

  override _setup() {
    this.stats = {
      gridIndex: this.input.gridIndex,
    }

    this.placedIndexByLayer = Array.from(
      { length: this.input.layerCount },
      () => new RBush<RTreeRect>(),
    )
    for (const placement of this.input.placed) {
      for (const z of placement.zLayers) {
        const placedIndex = this.placedIndexByLayer[z]
        if (placedIndex)
          placedIndex.insert(
            rectToTree(placement.rect, { zLayers: placement.zLayers }),
          )
      }
    }
  }

  override _step() {
    if (this.solved) return

    this._stepExpansion()

    this.stats.gridIndex = this.input.gridIndex
    this.stats.placed = this.input.placed.length

    if (this.input.expansionIndex >= this.input.placed.length) {
      this.finalizeIfNeeded()
    }
  }

  private _stepExpansion(): void {
    if (this.input.expansionIndex >= this.input.placed.length) {
      return
    }

    const idx = this.input.expansionIndex
    const p = this.input.placed[idx]!
    const lastGrid =
      this.input.options.gridSizes[this.input.options.gridSizes.length - 1]!

    const oldRect = p.rect
    const expanded = expandRectFromSeed({
      startX: p.rect.x + p.rect.width / 2,
      startY: p.rect.y + p.rect.height / 2,
      gridSize: lastGrid,
      bounds: this.input.bounds,
      obsticalIndexByLayer: this.input.obstacleIndexByLayer,
      placedIndexByLayer: this.placedIndexByLayer,
      initialCellRatio: 0,
      maxAspectRatio: null,
      minReq: { width: p.rect.width, height: p.rect.height },
      zLayers: p.zLayers,
    })

    if (expanded) {
      // Update placement + per-layer index (replace old rect object)
      this.input.placed[idx] = { rect: expanded, zLayers: p.zLayers }
      for (const z of p.zLayers) {
        const tree = this.placedIndexByLayer[z]
        if (tree) {
          tree.remove(rectToTree(oldRect, { zLayers: p.zLayers }), sameTreeRect)
          tree.insert(rectToTree(expanded, { zLayers: p.zLayers }))
        }
      }

      // Carve overlapped soft neighbors (respect full-stack nodes)
      resizeSoftOverlaps(
        {
          layerCount: this.input.layerCount,
          placed: this.input.placed,
          options: this.input.options,
          placedIndexByLayer: this.placedIndexByLayer,
        },
        idx,
      )
    }

    this.input.expansionIndex += 1
  }

  private finalizeIfNeeded() {
    if (this.solved) return

    const rects = finalizeRects({
      placed: this.input.placed,
      obstacles: this.input.obstacles,
      zIndexByName: this.input.zIndexByName,
      boardVoidRects: this.input.boardVoidRects,
    })
    this._meshNodes = rectsToMeshNodes(rects)
    this.solved = true
  }

  computeProgress(): number {
    if (this.solved) return 1
    const grids = this.input.options.gridSizes.length
    const base = grids / (grids + 1)
    const denom = Math.max(1, this.input.placed.length)
    const frac = denom ? this.input.expansionIndex / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    if (this.solved) return { meshNodes: this._meshNodes }

    // Provide a live preview of the placements before finalization so debuggers
    // can inspect intermediary states without forcing the solver to finish.
    const previewNodes: CapacityMeshNode[] = this.input.placed.map(
      (placement, idx) => ({
        capacityMeshNodeId: `expand-preview-${idx}`,
        center: {
          x: placement.rect.x + placement.rect.width / 2,
          y: placement.rect.y + placement.rect.height / 2,
        },
        width: placement.rect.width,
        height: placement.rect.height,
        availableZ: placement.zLayers.slice(),
        layer: `z${placement.zLayers.join(",")}`,
      }),
    )
    return { meshNodes: previewNodes }
  }

  /** Simple visualization of expanded placements. */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []

    for (const placement of this.input.placed ?? []) {
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
