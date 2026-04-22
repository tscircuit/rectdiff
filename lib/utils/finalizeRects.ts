import type { Obstacle } from "lib/types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
import {
  obstacleToXYRect,
  obstacleZs,
} from "../solvers/RectDiffSeedingSolver/layers"
import { partitionPlacedRectsByCoverage } from "./partitionPlacedRectsByCoverage"

export function finalizeRects(params: {
  placed: Placed3D[]
  obstacles: Obstacle[]
  boardVoidRects: XYRect[]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): Rect3d[] {
  // Re-partition free-space by actual XY coverage so overlapping per-layer
  // placements become explicit multi-layer nodes in the final mesh.
  const out: Rect3d[] = partitionPlacedRectsByCoverage(params.placed)

  const layersByKey = new Map<string, { rect: XYRect; layers: Set<number> }>()

  for (const obstacle of params.obstacles ?? []) {
    const baseRect = obstacleToXYRect(obstacle)
    if (!baseRect) continue
    const rect = params.obstacleClearance
      ? {
          x: baseRect.x - params.obstacleClearance,
          y: baseRect.y - params.obstacleClearance,
          width: baseRect.width + 2 * params.obstacleClearance,
          height: baseRect.height + 2 * params.obstacleClearance,
        }
      : baseRect
    const zLayers =
      obstacle.zLayers?.length && obstacle.zLayers.length > 0
        ? obstacle.zLayers
        : obstacleZs(obstacle, params.zIndexByName)
    const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`
    let entry = layersByKey.get(key)
    if (!entry) {
      entry = { rect, layers: new Set() }
      layersByKey.set(key, entry)
    }
    zLayers.forEach((layer: number) => entry!.layers.add(layer))
  }

  for (const { rect, layers } of layersByKey.values()) {
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
