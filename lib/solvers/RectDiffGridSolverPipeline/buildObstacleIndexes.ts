import type { SimpleRouteJson } from "lib/types/srj-types"
import RBush from "rbush"
import { computeInverseRects } from "lib/solvers/RectDiffSeedingSolver/computeInverseRects"
import {
  buildZIndexMap,
  obstacleToXYRect,
  obstacleZs,
} from "lib/solvers/RectDiffSeedingSolver/layers"
import type { XYRect } from "lib/rectdiff-types"
import type { RTreeRect } from "lib/types/capacity-mesh-types"

export const buildObstacleIndexesByLayer = (params: {
  srj: SimpleRouteJson
  boardVoidRects?: XYRect[]
}): {
  obstacleIndexByLayer: Array<RBush<RTreeRect>>
} => {
  const { srj, boardVoidRects } = params
  const { layerNames, zIndexByName } = buildZIndexMap(srj)
  const layerCount = Math.max(1, layerNames.length, srj.layerCount || 1)
  const bounds: XYRect = {
    x: srj.bounds.minX,
    y: srj.bounds.minY,
    width: srj.bounds.maxX - srj.bounds.minX,
    height: srj.bounds.maxY - srj.bounds.minY,
  }
  const obstacleIndexByLayer = Array.from(
    { length: layerCount },
    () => new RBush<RTreeRect>(),
  )

  const insertObstacle = (rect: XYRect, z: number) => {
    const treeRect: RTreeRect = {
      ...rect,
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
      zLayers: [z],
    }
    obstacleIndexByLayer[z]?.insert(treeRect)
  }

  if (srj.outline && srj.outline.length > 2) {
    for (const voidRect of boardVoidRects ?? []) {
      for (let z = 0; z < layerCount; z++) insertObstacle(voidRect, z)
    }
  }

  for (const obstacle of srj.obstacles ?? []) {
    const rect = obstacleToXYRect(obstacle as any)
    if (!rect) continue
    const zLayers = obstacleZs(obstacle as any, zIndexByName)
    // Filter out z-layers outside the valid range instead of throwing an error
    const validZLayers = zLayers.filter((z) => z >= 0 && z < layerCount)
    if (validZLayers.length === 0) continue
    if (
      (!obstacle.zLayers || obstacle.zLayers.length === 0) &&
      validZLayers.length
    ) {
      obstacle.zLayers = validZLayers
    }
    for (const z of validZLayers) insertObstacle(rect, z)
  }

  return { obstacleIndexByLayer }
}
