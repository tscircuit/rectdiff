// utils/rectsEqual.ts
import type { XYRect } from "../lib/solvers/rectdiff/types"
import { EPS } from "../lib/solvers/rectdiff/geometry"

/**
 * Checks if two rectangles are equal within a small tolerance (EPS).
 * @param a The first rectangle.
 * @param b The second rectangle.
 * @returns True if the rectangles are equal, false otherwise.
 */
export function rectsEqual(a: XYRect, b: XYRect): boolean {
  return (
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS
  )
}
