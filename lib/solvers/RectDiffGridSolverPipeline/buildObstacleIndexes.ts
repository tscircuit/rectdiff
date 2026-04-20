import type { SimpleRouteJson } from "../../types/srj-types"
import RBush from "rbush"
import { computeInverseRects } from "../RectDiffSeedingSolver/computeInverseRects"
import { buildZIndexMap, obstacleZs } from "../RectDiffSeedingSolver/layers"
import type { XYRect } from "../../rectdiff-types"
import type { RTreeRect } from "../../types/capacity-mesh-types"
import { padRect } from "../../utils/padRect"
import { getApproximateObstacleRects } from "../../utils/obstacleGeometry"

export const buildObstacleIndexesByLayer = (params: {
  srj: SimpleRouteJson
  boardVoidRects?: XYRect[]
  obstacleClearance?: number
  rotatedObstacleGridSize?: number
}): {
  obstacleIndexByLayer: Array<RBush<RTreeRect>>
  layerNames: string[]
  zIndexByName: Map<string, number>
} => {
  const { srj, boardVoidRects, obstacleClearance, rotatedObstacleGridSize } =
    params
  const { layerNames, zIndexByName } = buildZIndexMap({
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
    const rects = getApproximateObstacleRects(obstacle, {
      rotatedObstacleGridSize,
    })
    if (rects.length === 0) continue
    const zLayers = obstacleZs(obstacle, zIndexByName)
    const invalidZs = zLayers.filter((z) => z < 0 || z >= layerCount)
    if (invalidZs.length) {
      throw new Error(
        `RectDiff: obstacle uses z-layer indices ${invalidZs.join(",")} outside 0-${layerCount - 1}`,
      )
    }
    if (
      (!obstacle.zLayers || obstacle.zLayers.length === 0) &&
      zLayers.length
    ) {
      obstacle.zLayers = zLayers
    }
    for (const rectBase of rects) {
      const rect = padRect(rectBase, obstacleClearance ?? 0)
      for (const z of zLayers) insertObstacle(rect, z)
    }
  }

  return { obstacleIndexByLayer, layerNames, zIndexByName }
}
