import type { Obstacle } from "lib/types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
import { obstacleToXYRect, obstacleZs } from "../solvers/RectDiffSeedingSolver/layers"

export function finalizeRects(params: {
  placed: Placed3D[]
  obstacles: Obstacle[]
  boardVoidRects: XYRect[]
  zIndexByName: Map<string, number>
}): Rect3d[] {
  // Convert all placed (free space) nodes to output format
  const out: Rect3d[] = params.placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))

  const layersByKey = new Map<string, { rect: XYRect; layers: Set<number> }>()

  for (const obstacle of params.obstacles ?? []) {
    const rect = obstacleToXYRect(obstacle as any)
    if (!rect) continue
    const zLayers =
      obstacle.zLayers?.length && obstacle.zLayers.length > 0
        ? obstacle.zLayers
        : obstacleZs(obstacle as any, params.zIndexByName)
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
