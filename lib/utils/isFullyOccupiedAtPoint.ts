import type {
  MightBeFullStackRect,
  RTreeRect,
} from "lib/types/capacity-mesh-types"
import RBush from "rbush"

export type OccupancyParams = {
  layerCount: number
  obstacleIndexByLayer: Array<RBush<RTreeRect> | undefined>
  placedIndexByLayer: Array<RBush<MightBeFullStackRect> | undefined>
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
    const hasObstacle = !!obstacleIdx && obstacleIdx.search(query).length > 0

    const placedIdx = params.placedIndexByLayer[z]
    const hasPlaced = !!placedIdx && placedIdx.search(query).length > 0

    if (!hasObstacle && !hasPlaced) return false
  }
  return true
}
