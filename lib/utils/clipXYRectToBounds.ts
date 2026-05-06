import type { Bounds } from "@tscircuit/math-utils"
import type { XYRect } from "../rectdiff-types"

const EPS = 1e-9

/**
 * Keeps only the part of a rectangle that lies inside the board bounds.
 *
 * In general terms, this trims away any area that hangs off the board edge.
 * If the rectangle does not overlap the board at all, it returns `null`.
 */
export const clipXYRectToBounds = (
  rect: XYRect,
  bounds: Bounds,
): XYRect | null => {
  const minX = Math.max(rect.x, bounds.minX)
  const maxX = Math.min(rect.x + rect.width, bounds.maxX)
  const minY = Math.max(rect.y, bounds.minY)
  const maxY = Math.min(rect.y + rect.height, bounds.maxY)
  const width = maxX - minX
  const height = maxY - minY

  if (width <= EPS || height <= EPS) return null

  return {
    x: minX,
    y: minY,
    width,
    height,
  }
}
