import type { Obstacle } from "../types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
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
  // Convert all placed (free space) nodes to output format
  const out: Rect3d[] = params.placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))

  // NOTE: Obstacle nodes are emitted one-for-one from SRJ. Do not group them
  // only by geometry: distinct obstacles can share XY bounds while belonging
  // to different layers or nets.
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

    out.push({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
      zLayers: [...new Set(zLayers)].sort((a, b) => a - b),
      isObstacle: true,
      connectedTo: [...obstacle.connectedTo],
    })
  }

  return out
}
