// utils/rectsOverlap.ts
import type { XYRect } from "../lib/solvers/rectdiff/types"
import { EPS } from "../lib/solvers/rectdiff/geometry"

/**
 * Checks if two rectangles overlap.
 * @param a The first rectangle.
 * @param b The second rectangle.
 * @returns True if the rectangles overlap, false otherwise.
 */
export function rectsOverlap(a: XYRect, b: XYRect): boolean {
  return !(
    a.x + a.width <= b.x + EPS ||
    b.x + b.width <= a.x + EPS ||
    a.y + a.height <= b.y + EPS ||
    b.y + b.height <= a.y + EPS
  )
}
