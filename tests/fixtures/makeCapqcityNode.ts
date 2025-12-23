import type { Rect } from "graphics-debug"
import type { RectDiffPipeline } from "lib/RectDiffPipeline"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"

type MeshNodes = ReturnType<RectDiffPipeline["getOutput"]>["meshNodes"]

export const makeCapacityMeshNodeWithLayerInfo = (nodes: MeshNodes): Map<string, Rect[]> => {
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
      stroke: colors.stroke,
      fill: colors.fill,
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