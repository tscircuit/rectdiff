import type { XYRect } from "../../rectdiff-types"

/**
 * Build the bounding box that contains both rectangles.
 * Coalescing uses this candidate box and then proves it is fully covered.
 */
export const mergeRects = ({ a, b }: { a: XYRect; b: XYRect }): XYRect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
  height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
})
