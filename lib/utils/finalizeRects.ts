import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
import { MergeToMaximizeLargeMultiLayerNodesSolver } from "../solvers/MergeToMaximizeLargeMultiLayerNodes/MergeToMaximizeLargeMultiLayerNodesSolver"
import type { Obstacle } from "../types/srj-types"

export function finalizeRects(params: {
  placed: Placed3D[]
  obstacles: Obstacle[]
  boardVoidRects: XYRect[]
  zIndexByName: Map<string, number>
  layerCount?: number
  obstacleClearance?: number
}): Rect3d[] {
  const solver = new MergeToMaximizeLargeMultiLayerNodesSolver({
    placed: params.placed,
    obstacles: params.obstacles,
    layerCount:
      params.layerCount ??
      Math.max(1, ...params.placed.flatMap((p) => p.zLayers.map((z) => z + 1))),
    zIndexByName: params.zIndexByName,
    obstacleClearance: params.obstacleClearance,
  })
  solver.solve()
  return solver.getOutput().rects
}
