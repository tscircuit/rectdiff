import type { XYRect } from "./types"
import { EPS } from "../rectdiff/geometry"

/**
 * Check if two rectangles overlap (with EPS tolerance)
 */
export function rectsOverlap(rectA: XYRect, rectB: XYRect): boolean {
  return !(
    rectA.x + rectA.width <= rectB.x + EPS ||
    rectB.x + rectB.width <= rectA.x + EPS ||
    rectA.y + rectA.height <= rectB.y + EPS ||
    rectB.y + rectB.height <= rectA.y + EPS
  )
}

