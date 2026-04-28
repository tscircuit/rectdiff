import type { XYRect } from "../../rectdiff-types"

/**
 * Build one rectangle that covers both inputs.
 * This is the outer box around the two shapes.
 */
export const mergeRects = ({ a, b }: { a: XYRect; b: XYRect }): XYRect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
  height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
})
