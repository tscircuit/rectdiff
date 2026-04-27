import { BaseSolver } from "@tscircuit/solver-utils"
import type { Placed3D, Rect3d, XYRect } from "../../rectdiff-types"
import type { Obstacle } from "../../types/srj-types"
import { subtractRect2D } from "../../utils/rectdiff-geometry"
import { obstacleToXYRect, obstacleZs } from "../RectDiffSeedingSolver/layers"

export type MergeToMaximizeLargeMultiLayerNodesSolverInput = {
  placed: Placed3D[]
  obstacles: Obstacle[]
  layerCount: number
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}

/**
 * Merge strategy for multi-layer nodes:
 * - First, compute the largest rectangles that are valid on ALL layers of a
 *   candidate placement (subtracting the union of per-layer obstacles).
 * - Then, compute leftover per-layer rectangles after subtracting both the
 *   per-layer obstacles and the already-claimed common rectangles.
 *
 * This maximizes large multi-layer rectangles while preserving correctness.
 */
export class MergeToMaximizeLargeMultiLayerNodesSolver extends BaseSolver {
  private outputRects: Rect3d[] = []

  constructor(private input: MergeToMaximizeLargeMultiLayerNodesSolverInput) {
    super()
  }

  override _setup() {
    this.outputRects = []
  }

  override _step() {
    this.outputRects = this.compute()
    this.solved = true
  }

  private compute(): Rect3d[] {
    const out: Rect3d[] = []
    const obstacleRectsByLayer = new Map<number, XYRect[]>()
    const obstaclesByKey = new Map<
      string,
      { rect: XYRect; layers: Set<number> }
    >()

    const keyOfRect = (rect: XYRect) =>
      `${rect.x}:${rect.y}:${rect.width}:${rect.height}`

    const subtractMany = (parts: XYRect[], cutters: XYRect[]) => {
      let remaining = parts
      for (const cutter of cutters) {
        if (remaining.length === 0) break
        const nextParts: XYRect[] = []
        for (const part of remaining) {
          nextParts.push(...subtractRect2D(part, cutter))
        }
        remaining = nextParts
      }
      return remaining
    }

    // Index obstacles by layer and also create merged obstacle rect entries.
    for (const obstacle of this.input.obstacles ?? []) {
      const baseRect = obstacleToXYRect(obstacle)
      if (!baseRect) continue

      const rect =
        this.input.obstacleClearance && this.input.obstacleClearance > 0
          ? {
              x: baseRect.x - this.input.obstacleClearance,
              y: baseRect.y - this.input.obstacleClearance,
              width: baseRect.width + 2 * this.input.obstacleClearance,
              height: baseRect.height + 2 * this.input.obstacleClearance,
            }
          : baseRect

      const zLayers =
        obstacle.zLayers?.length && obstacle.zLayers.length > 0
          ? obstacle.zLayers
          : obstacleZs(obstacle, this.input.zIndexByName)

      for (const layer of zLayers) {
        const list = obstacleRectsByLayer.get(layer)
        if (list) list.push(rect)
        else obstacleRectsByLayer.set(layer, [rect])
      }

      const key = keyOfRect(rect)
      let entry = obstaclesByKey.get(key)
      if (!entry) {
        entry = { rect, layers: new Set() }
        obstaclesByKey.set(key, entry)
      }
      for (const layer of zLayers) {
        entry.layers.add(layer)
      }
    }

    const freeRectsByKey = new Map<
      string,
      { rect: XYRect; layers: Set<number> }
    >()

    for (const placed of this.input.placed ?? []) {
      const layers = Array.from(new Set(placed.zLayers))
        .filter((z) => z >= 0 && z < this.input.layerCount)
        .sort((a, b) => a - b)
      if (layers.length === 0) continue

      const claimedMultiParts: XYRect[] = []

      const addFreePart = (rect: XYRect, zLayers: number[]) => {
        const key = keyOfRect(rect)
        let entry = freeRectsByKey.get(key)
        if (!entry) {
          entry = { rect, layers: new Set() }
          freeRectsByKey.set(key, entry)
        }
        for (const z of zLayers) entry.layers.add(z)
      }

      const unionBlockersForLayers = (zLayers: number[]) => {
        const blockersByKey = new Map<string, XYRect>()
        for (const z of zLayers) {
          const blockers = obstacleRectsByLayer.get(z) ?? []
          for (const b of blockers) blockersByKey.set(keyOfRect(b), b)
        }
        return Array.from(blockersByKey.values())
      }

      const maxSpan = Math.min(this.input.layerCount, layers.length)
      for (let span = maxSpan; span >= 2; span -= 1) {
        for (let start = 0; start + span <= this.input.layerCount; start += 1) {
          const spanLayers: number[] = []
          for (let z = start; z < start + span; z += 1) spanLayers.push(z)
          if (!spanLayers.every((z) => layers.includes(z))) continue

          const blockers = unionBlockersForLayers(spanLayers)
          let parts = subtractMany([placed.rect], blockers)
          if (parts.length === 0) continue
          if (claimedMultiParts.length > 0) {
            parts = subtractMany(parts, claimedMultiParts)
            if (parts.length === 0) continue
          }

          for (const part of parts) {
            addFreePart(part, spanLayers)
            claimedMultiParts.push(part)
          }
        }
      }

      for (const z of layers) {
        let parts = subtractMany(
          [placed.rect],
          obstacleRectsByLayer.get(z) ?? [],
        )
        if (parts.length === 0) continue
        if (claimedMultiParts.length > 0) {
          parts = subtractMany(parts, claimedMultiParts)
          if (parts.length === 0) continue
        }
        for (const part of parts) addFreePart(part, [z])
      }
    }

    for (const { rect, layers } of freeRectsByKey.values()) {
      const layerList = Array.from(layers).sort((a, b) => a - b)
      if (layerList.length === 0) continue
      out.push({
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width,
        maxY: rect.y + rect.height,
        zLayers: layerList,
      })
    }

    for (const { rect, layers } of obstaclesByKey.values()) {
      out.push({
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width,
        maxY: rect.y + rect.height,
        zLayers: Array.from(layers).sort((a, b) => a - b),
        isObstacle: true,
      })
    }

    return out
  }

  override getOutput(): { rects: Rect3d[] } {
    return { rects: this.outputRects }
  }
}
