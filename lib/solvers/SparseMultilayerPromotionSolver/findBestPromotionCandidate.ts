import { hasContiguousZSpan } from "../../math/layers/hasContiguousZSpan"
import { getUnionZ } from "../../math/layers/getUnionZ"
import { intersectRects } from "../../math/rects/intersectRects"
import { rectArea } from "../../math/rects/rectArea"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { EPS } from "../../utils/rectdiff-geometry"
import { isFreeNode } from "./isFreeNode"
import { nodeToRect } from "./nodeToRect"
import type { PromotionCandidate } from "./types"

/**
 * Find the best overlap that upgrades a single-layer node into a larger span.
 * The score is overlap area, which preserves the current promotion behavior.
 */
export const findBestPromotionCandidate = ({
  minRectSize,
  nodes,
}: {
  minRectSize: number
  nodes: CapacityMeshNode[]
}): PromotionCandidate | null => {
  let best: PromotionCandidate | null = null

  for (let i = 0; i < nodes.length; i++) {
    const sourceNode = nodes[i]!
    if (
      !isFreeNode({ node: sourceNode }) ||
      sourceNode.availableZ.length !== 1
    ) {
      continue
    }

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue

      const targetNode = nodes[j]!
      if (!isFreeNode({ node: targetNode })) continue

      const unionZ = getUnionZ({
        a: sourceNode.availableZ,
        b: targetNode.availableZ,
      })
      if (unionZ.length <= targetNode.availableZ.length) continue
      if (!hasContiguousZSpan({ zValues: unionZ })) continue

      const overlapRect = intersectRects({
        a: nodeToRect({ node: sourceNode }),
        b: nodeToRect({ node: targetNode }),
      })
      if (!overlapRect) continue
      if (
        overlapRect.width + EPS < minRectSize ||
        overlapRect.height + EPS < minRectSize
      ) {
        continue
      }

      const area = rectArea({ rect: overlapRect })
      if (!best || area > best.area) {
        best = {
          rect: overlapRect,
          sourceNode,
          targetNode,
          unionZ,
          area,
        }
      }
    }
  }

  return best
}
