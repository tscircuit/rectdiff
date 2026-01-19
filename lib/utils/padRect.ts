import type { XYRect } from "../rectdiff-types"

export const padRect = (rect: XYRect, clearance: number): XYRect => {
  if (!clearance || clearance <= 0) return rect
  return {
    x: rect.x - clearance,
    y: rect.y - clearance,
    width: rect.width + 2 * clearance,
    height: rect.height + 2 * clearance,
  }
}
