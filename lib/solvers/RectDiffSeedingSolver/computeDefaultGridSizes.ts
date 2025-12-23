import type { XYRect } from "../../rectdiff-types"

/**
 * Compute default grid sizes based on bounds.
 */
export function computeDefaultGridSizes(bounds: XYRect): number[] {
  const ref = Math.max(bounds.width, bounds.height)
  return [ref / 8, ref / 16, ref / 32]
}
