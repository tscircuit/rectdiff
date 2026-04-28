import type { XYRect } from "../../rectdiff-types"
import { EPS } from "../../utils/rectdiff-geometry"

/**
 * Test whether one rectangle fully contains another under EPS tolerance.
 * This is used to collect every tile absorbed by a coalesced region.
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
