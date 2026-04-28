import { getZSpanMask } from "../../math/layers/getZSpanMask"
import { mergeRects } from "../../math/rects/mergeRects"
import { rectArea } from "../../math/rects/rectArea"
import { rectContainsRect } from "../../math/rects/rectContainsRect"
import { rectsTouchOrOverlap } from "../../math/rects/rectsTouchOrOverlap"
import { subtractRects } from "../../math/rects/subtractRects"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { isFreeNode } from "./isFreeNode"
import { nodeToRect } from "./nodeToRect"
import type { CoalesceCandidate } from "./types"

const areRectsAlignedForMerge = ({
  a,
  b,
}: {
  a: ReturnType<typeof nodeToRect>
  b: ReturnType<typeof nodeToRect>
}) => {
  const sameVerticalBand =
    Math.abs(a.x - b.x) <= Number.EPSILON &&
    Math.abs(a.width - b.width) <= Number.EPSILON &&
    a.y <= b.y + b.height + Number.EPSILON &&
    b.y <= a.y + a.height + Number.EPSILON

  const sameHorizontalBand =
    Math.abs(a.y - b.y) <= Number.EPSILON &&
    Math.abs(a.height - b.height) <= Number.EPSILON &&
    a.x <= b.x + b.width + Number.EPSILON &&
    b.x <= a.x + a.width + Number.EPSILON

  return sameVerticalBand || sameHorizontalBand
}

/**
 * Find one fully covered bounding box that collapses many shared tiles at once.
 * The score prefers larger boxes that absorb more nodes.
 */
export const findBestCoalesceCandidate = ({
  nodes,
}: {
  nodes: CapacityMeshNode[]
}): CoalesceCandidate | null => {
  let best: CoalesceCandidate | null = null
  const nodesBySpan = new Map<
    number,
    Array<{ node: CapacityMeshNode; rect: ReturnType<typeof nodeToRect> }>
  >()

  for (const node of nodes) {
    if (!isFreeNode({ node }) || node.availableZ.length <= 1) continue
    const spanKey = getZSpanMask({ availableZ: node.availableZ })
    const entries = nodesBySpan.get(spanKey) ?? []
    entries.push({ node, rect: nodeToRect({ node }) })
    nodesBySpan.set(spanKey, entries)
  }

  for (const entries of nodesBySpan.values()) {
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i]!

      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j]!
        if (
          !areRectsAlignedForMerge({ a: a.rect, b: b.rect }) &&
          !rectsTouchOrOverlap({ a: a.rect, b: b.rect })
        ) {
          continue
        }

        const mergedRect = mergeRects({ a: a.rect, b: b.rect })
        const absorbedEntries = entries.filter((entry) =>
          rectContainsRect({ inner: entry.rect, outer: mergedRect }),
        )
        if (absorbedEntries.length < 2) continue

        if (
          subtractRects({
            target: mergedRect,
            cutters: absorbedEntries.map((entry) => entry.rect),
          }).length > 0
        ) {
          continue
        }

        const score = rectArea({ rect: mergedRect }) * absorbedEntries.length
        if (!best || score > best.score) {
          best = {
            rect: mergedRect,
            absorbedNodes: absorbedEntries.map((entry) => entry.node),
            score,
          }
        }
      }
    }
  }

  return best
}
