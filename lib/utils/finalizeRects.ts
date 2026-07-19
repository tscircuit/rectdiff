import type { Obstacle } from "../types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
import {
  obstacleToXYRect,
  obstacleZs,
} from "../solvers/RectDiffSeedingSolver/layers"

type ObstacleRectGroup = {
  rect: XYRect
  layers: Set<number>
  connectedToByZ: Map<number, Set<string>>
}

const getSortedConnectionNames = (
  connectedTo: Iterable<string>,
): string[] => [...new Set(connectedTo)].sort()

const getSharedConnectionNames = (
  zLayers: number[],
  connectedToByZ: Map<number, Set<string>>,
): string[] => {
  const firstZ = zLayers[0]
  if (firstZ === undefined) return []

  const sharedNames = getSortedConnectionNames(
    connectedToByZ.get(firstZ) ?? [],
  )
  const allLayersMatch = zLayers.slice(1).every((z) => {
    const layerNames = getSortedConnectionNames(connectedToByZ.get(z) ?? [])
    return (
      layerNames.length === sharedNames.length &&
      layerNames.every((name, index) => name === sharedNames[index])
    )
  })

  return allLayersMatch ? sharedNames : []
}

export function finalizeRects(params: {
  placed: Placed3D[]
  obstacles: Obstacle[]
  boardVoidRects: XYRect[]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): Rect3d[] {
  // Convert all placed (free space) nodes to output format
  const out: Rect3d[] = params.placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))

  const obstacleRectsByKey = new Map<string, ObstacleRectGroup>()

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
    let entry = obstacleRectsByKey.get(key)
    if (!entry) {
      entry = {
        rect,
        layers: new Set(),
        connectedToByZ: new Map(),
      }
      obstacleRectsByKey.set(key, entry)
    }

    for (const z of zLayers) {
      entry.layers.add(z)
      let connectionNames = entry.connectedToByZ.get(z)
      if (!connectionNames) {
        connectionNames = new Set()
        entry.connectedToByZ.set(z, connectionNames)
      }
      for (const connectionName of obstacle.connectedTo) {
        connectionNames.add(connectionName)
      }
    }
  }

  for (const { rect, layers, connectedToByZ } of obstacleRectsByKey.values()) {
    const zLayers = Array.from(layers).sort((a, b) => a - b)
    const connectedToByZRecord: Record<number, string[]> = {}
    for (const z of zLayers) {
      connectedToByZRecord[z] = getSortedConnectionNames(
        connectedToByZ.get(z) ?? [],
      )
    }

    out.push({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
      zLayers,
      isObstacle: true,
      connectedTo: getSharedConnectionNames(zLayers, connectedToByZ),
      connectedToByZ: connectedToByZRecord,
    })
  }

  return out
}
