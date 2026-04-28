import type { XYRect } from "../../rectdiff-types"
import { EPS } from "../../utils/rectdiff-geometry"

/**
 * Check whether one rectangle fully contains another.
 * A small tolerance is used for edge cases.
 */
export const rectContainsRect = ({
  inner,
  outer,
}: {
  inner: XYRect
  outer: XYRect
}) =>
  inner.x + EPS >= outer.x &&
  inner.y + EPS >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width + EPS &&
  inner.y + inner.height <= outer.y + outer.height + EPS
