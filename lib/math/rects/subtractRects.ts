import type { XYRect } from "../../rectdiff-types"
import { subtractRect2D } from "../../utils/rectdiff-geometry"

/**
 * Subtract many cutter rectangles from a target rectangle.
 * The remaining pieces are used to verify full box coverage and residual space.
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
