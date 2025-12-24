import RBush from "rbush"
import type { XYRect } from "lib/rectdiff-types"
import type { RTreeRect } from "lib/types/capacity-mesh-types"
import { rectToTree } from "./rectToTree"
import { sameTreeRect } from "./sameTreeRect"

export const ensureBoardVoidRectsInObstacleIndex = (
  boardVoidRects: XYRect[] | undefined,
  obstacleIndexByLayer: Array<RBush<RTreeRect>>,
): Array<RBush<RTreeRect>> => {
  if (!boardVoidRects?.length) return obstacleIndexByLayer

  for (let z = 0; z < obstacleIndexByLayer.length; z++) {
    if (!obstacleIndexByLayer[z]) {
      obstacleIndexByLayer[z] = new RBush<RTreeRect>()
    }
    const tree = obstacleIndexByLayer[z]!
    const existing = tree.all()
    const seen = new Set<string>()
    for (const rect of existing) {
      seen.add(`${rect.minX}:${rect.minY}:${rect.maxX}:${rect.maxY}`)
    }

    for (const rect of boardVoidRects) {
      const treeRect = rectToTree(rect)
      const key = `${treeRect.minX}:${treeRect.minY}:${treeRect.maxX}:${treeRect.maxY}`
      if (seen.has(key)) continue
      if (!existing.some((item) => sameTreeRect(item, treeRect))) {
        tree.insert(treeRect)
        existing.push(treeRect)
        seen.add(key)
      }
    }
  }

  return obstacleIndexByLayer
}
