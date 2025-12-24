import type { Rect } from "graphics-debug"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"

export const makeCapacityMeshNodeWithLayerInfo = (
  nodes: CapacityMeshNode[],
): Map<string, Rect[]> => {
  const map = new Map<string, Rect[]>()

  for (const node of nodes) {
    if (!node.availableZ.length) continue
    const key = node.availableZ.join(",")
    const colors = getColorForZLayer(node.availableZ)
    const rect: Rect = {
      center: node.center,
      width: node.width,
      height: node.height,
      layer: `z${key}`,
      stroke: "black",
      fill: node._containsObstacle ? "red" : colors.fill,
      label: "node",
    }

    const existing = map.get(key)
    if (existing) {
      existing.push(rect)
    } else {
      map.set(key, [rect])
    }
  }

  return map
}
