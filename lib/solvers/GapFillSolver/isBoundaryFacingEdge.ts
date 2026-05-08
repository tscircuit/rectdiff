import type { Bounds } from "@tscircuit/math-utils"
import type { ClippedNodeBounds } from "./clipNodeToBounds"
import type { SegmentWithAdjacentEmptySpace } from "./FindSegmentsWithAdjacentEmptySpaceSolver"

const EPS = 1e-4

/**
 * Returns `true` when an edge lies directly on the outer board boundary and
 * points outward from it.
 *
 * In general terms, once a node has been trimmed to the board area, some of its
 * sides may sit exactly on the board outline. Those sides are not useful for
 * gap-filling because there is no valid routing space beyond the board edge.
 * This helper detects those cases so the solver can ignore them.
 */
export const isBoundaryFacingEdge = (
  edgeDirection: SegmentWithAdjacentEmptySpace["facingDirection"],
  rectBounds: ClippedNodeBounds,
  bounds?: Bounds,
) => {
  if (!bounds) return false

  switch (edgeDirection) {
    case "x-":
      return Math.abs(rectBounds.minX - bounds.minX) < EPS
    case "x+":
      return Math.abs(rectBounds.maxX - bounds.maxX) < EPS
    case "y-":
      return Math.abs(rectBounds.minY - bounds.minY) < EPS
    case "y+":
      return Math.abs(rectBounds.maxY - bounds.maxY) < EPS
  }
}
