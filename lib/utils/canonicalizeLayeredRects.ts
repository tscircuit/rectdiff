import type { Placed3D, Rect3d } from "../rectdiff-types"
import { buildRowRuns } from "./buildRowRuns"
import { mergeRunsVertically } from "./mergeRunsVertically"

/** Rebuild placements into rectangles grouped by shared zLayers. */
export function canonicalizeLayeredRects(placed: Placed3D[]): Rect3d[] {
  if (placed.length === 0) {
    return []
  }
  return mergeRunsVertically(buildRowRuns(placed))
}
