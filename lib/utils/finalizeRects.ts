import type { Obstacle } from "../types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
import { subtractRect2D } from "./rectdiff-geometry"
import {
  obstacleToXYRect,
  obstacleZs,
} from "../solvers/RectDiffSeedingSolver/layers"

export function finalizeRects(params: {
  placed: Placed3D[]
  obstacles: Obstacle[]
  boardVoidRects: XYRect[]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): Rect3d[] {
  const out: Rect3d[] = []
  const obstacleRectsByLayer = new Map<number, XYRect[]>()

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
    for (const layer of zLayers) {
      const list = obstacleRectsByLayer.get(layer)
      if (list) list.push(rect)
      else obstacleRectsByLayer.set(layer, [rect])
    }
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

  const freeRectsByKey = new Map<
    string,
    { rect: XYRect; layers: Set<number> }
  >()

  for (const placed of params.placed) {
    for (const layer of placed.zLayers) {
      let parts: XYRect[] = [placed.rect]
      const blockers = obstacleRectsByLayer.get(layer) ?? []
      for (const blocker of blockers) {
        const nextParts: XYRect[] = []
        for (const part of parts) {
          const carved = subtractRect2D(part, blocker)
          nextParts.push(...carved)
        }
        parts = nextParts
        if (parts.length === 0) break
      }

      for (const part of parts) {
        const key = `${part.x}:${part.y}:${part.width}:${part.height}`
        let entry = freeRectsByKey.get(key)
        if (!entry) {
          entry = { rect: part, layers: new Set() }
          freeRectsByKey.set(key, entry)
        }
        entry.layers.add(layer)
      }
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

  return out
}
