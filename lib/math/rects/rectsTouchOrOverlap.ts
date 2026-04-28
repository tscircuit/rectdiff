import type { XYRect } from "../../rectdiff-types"
import { EPS } from "../../utils/rectdiff-geometry"

/**
 * Check whether two rectangles touch or overlap.
 * Coalescing uses this to ignore boxes that are clearly disconnected.
 */
export const rectsTouchOrOverlap = ({ a, b }: { a: XYRect; b: XYRect }) =>
  a.x <= b.x + b.width + EPS &&
  b.x <= a.x + a.width + EPS &&
  a.y <= b.y + b.height + EPS &&
  b.y <= a.y + a.height + EPS
