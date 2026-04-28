import type { XYRect } from "../../rectdiff-types"
import { EPS } from "../../utils/rectdiff-geometry"

/**
 * Return the shared area between two rectangles.
 * Returns null when they do not overlap.
 */
export const intersectRects = ({
  a,
  b,
}: {
  a: XYRect
  b: XYRect
}): XYRect | null => {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.width, b.x + b.width)
  const y1 = Math.min(a.y + a.height, b.y + b.height)

  if (x1 <= x0 + EPS || y1 <= y0 + EPS) return null

  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
  }
}
