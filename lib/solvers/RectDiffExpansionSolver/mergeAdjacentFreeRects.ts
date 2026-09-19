import type { Rect3d } from "../../rectdiff-types"

/** Remove full-edge boundaries without changing layer coverage or net ownership. */
export function mergeAdjacentFreeRects(rects: Rect3d[]): Rect3d[] {
  const output = [...rects]
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < output.length; i++) {
      const a = output[i]!
      if (a.isObstacle || a.connectedTo?.length) continue
      for (let j = i + 1; j < output.length; j++) {
        const b = output[j]!
        if (b.isObstacle || b.connectedTo?.length) continue
        if (
          a.zLayers.length !== b.zLayers.length ||
          !a.zLayers.every((z, index) => z === b.zLayers[index])
        )
          continue
        const horizontal =
          a.minY === b.minY &&
          a.maxY === b.maxY &&
          (a.maxX === b.minX || b.maxX === a.minX)
        const vertical =
          a.minX === b.minX &&
          a.maxX === b.maxX &&
          (a.maxY === b.minY || b.maxY === a.minY)
        if (!horizontal && !vertical) continue
        output[i] = {
          ...a,
          minX: Math.min(a.minX, b.minX),
          minY: Math.min(a.minY, b.minY),
          maxX: Math.max(a.maxX, b.maxX),
          maxY: Math.max(a.maxY, b.maxY),
        }
        output.splice(j, 1)
        changed = true
        break
      }
    }
  }
  return output
}
