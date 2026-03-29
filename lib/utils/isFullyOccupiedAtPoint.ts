import type { RTreeRect } from "lib/types/capacity-mesh-types"
import RBush from "rbush"

export type OccupancyParams = {
  layerCount: number
  obstacleIndexByLayer: Array<RBush<RTreeRect> | undefined>
  placedIndexByLayer: Array<RBush<RTreeRect> | undefined>
  point: { x: number; y: number }
}

export function isFullyOccupiedAtPoint(params: OccupancyParams): boolean {
  const query = {
    minX: params.point.x,
    minY: params.point.y,
    maxX: params.point.x,
    maxY: params.point.y,
  }
  for (let z = 0; z < params.layerCount; z++) {
    const obstacleIdx = params.obstacleIndexByLayer[z]
    const hasObstacle = !!obstacleIdx && obstacleIdx.collides(query)

    const placedIdx = params.placedIndexByLayer[z]
    const hasPlaced = !!placedIdx && placedIdx.collides(query)

    if (!hasObstacle && !hasPlaced) return false
  }
  return true
}
