import type { XYRect } from "../rectdiff-types"
import { containsPoint } from "./rectdiff-geometry"

export function isFullyOccupiedAtPoint(
  params: {
    layerCount: number
    obstaclesByLayer: XYRect[][]
    placedByLayer: XYRect[][]
  },
  point: { x: number; y: number },
): boolean {
  for (let z = 0; z < params.layerCount; z++) {
    const obs = params.obstaclesByLayer[z] ?? []
    const placed = params.placedByLayer[z] ?? []
    const occ =
      obs.some((b) => containsPoint(b, point.x, point.y)) ||
      placed.some((b) => containsPoint(b, point.x, point.y))
    if (!occ) return false
  }
  return true
}
