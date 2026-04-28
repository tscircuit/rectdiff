import type { XYRect } from "../../rectdiff-types"
import { subtractRect2D } from "../../utils/rectdiff-geometry"

/**
 * Remove several rectangles from one rectangle.
 * The result is the list of remaining pieces.
 */
export const subtractRects = ({
  cutters,
  target,
}: {
  cutters: XYRect[]
  target: XYRect
}) => {
  let remaining: XYRect[] = [target]

  for (const cutter of cutters) {
    if (remaining.length === 0) return remaining
    remaining = remaining.flatMap((piece) => subtractRect2D(piece, cutter))
  }

  return remaining
}
