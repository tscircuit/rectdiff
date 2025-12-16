// lib/solvers/rectdiff/edge-expansion-gapfill/filterOverlappingNodes.ts
import type { GapFillNode } from "./types"
import type { XYRect, Placed3D } from "../types"
import { overlaps } from "../geometry"

/**
 * Filters out initial seed nodes that would immediately overlap with existing elements.
 *
 * **Context:**
 * When processing each obstacle, we create 4 tiny seed rectangles (one at each edge).
 * However, the space around an obstacle might already be occupied by:
 * - Capacity nodes created by the main RectDiff solver
 * - Other obstacles/components on the board
 * - Gap-fill nodes we've already placed from previous obstacles
 *
 * **Why this is needed:**
 * Without filtering, we'd attempt to place and expand nodes in already-occupied space,
 * causing immediate validation failures and overlaps. This prevents wasted work and errors.
 *
 * **Current usage:**
 * Called once per obstacle after creating initial seed nodes, before expansion begins.
 * Typically filters out 0-8 nodes (out of 4 initial nodes × layers) depending on how
 * crowded the area around the obstacle is.
 *
 * @param nodes - Initial seed nodes created around an obstacle (4 edge positions × layers)
 * @param existingPlacedByLayer - Capacity nodes from main solver, indexed by layer
 * @param obstaclesByLayer - All board obstacles/components, indexed by layer
 * @param newPlaced - Gap-fill nodes already placed from previously processed obstacles
 * @returns Filtered list of nodes that can be safely placed and expanded
 *
 * @internal This is an internal helper function for the edge expansion gap-fill algorithm
 */
export function filterOverlappingNodes(params: {
  nodes: GapFillNode[]
  existingPlacedByLayer: XYRect[][]
  obstaclesByLayer: XYRect[][]
  newPlaced: Placed3D[]
}): GapFillNode[] {
  const { nodes, existingPlacedByLayer, obstaclesByLayer, newPlaced } = params

  const validNodes = nodes.filter((node) => {
    // For each layer this node occupies, check for overlaps
    for (const z of node.zLayers) {
      // Check overlap with existing capacity nodes on this layer
      if (existingPlacedByLayer[z]) {
        for (const existing of existingPlacedByLayer[z]!) {
          if (overlaps(node.rect, existing)) {
            return false
          }
        }
      }

      // Check overlap with obstacles on this layer
      if (obstaclesByLayer[z]) {
        for (const obstacle of obstaclesByLayer[z]!) {
          if (overlaps(node.rect, obstacle)) {
            return false
          }
        }
      }
    }

    // Check overlap with previously placed gap-fill nodes
    for (const placed of newPlaced) {
      // Check if they share any layers
      const hasCommonLayer = node.zLayers.some((nz) =>
        placed.zLayers.includes(nz),
      )

      if (hasCommonLayer && overlaps(node.rect, placed.rect)) {
        return false
      }
    }

    return true
  })

  return validNodes
}
