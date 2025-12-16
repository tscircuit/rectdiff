// lib/solvers/rectdiff/edge-expansion-gapfill/calculateAvailableSpace.ts
import type { GapFillNode, Direction, EdgeExpansionGapFillState } from "./types"
import type { XYRect } from "../types"

const EPS = 1e-9

/**
 * Calculate how far a node can expand in a given direction before hitting blockers.
 *
 * **What it does:**
 * Determines the maximum distance a gap-fill node can expand in a specific direction
 * (up, down, left, or right) before it would collide with obstacles, existing capacity
 * nodes, or other gap-fill nodes. Returns the available expansion distance in millimeters.
 *
 * **How it works:**
 * 1. **Collects blockers** on the same z-layers as the node:
 *    - Existing capacity nodes from the main RectDiff solver
 *    - Board obstacles/components
 *    - Other gap-fill nodes currently being expanded
 *    - Previously placed gap-fill nodes
 *
 * 2. **Calculates initial distance** to the board boundary in the expansion direction
 *
 * 3. **Checks each blocker** to see if it's in the expansion path:
 *    - For vertical expansion (up/down): checks if blocker overlaps in x-axis
 *    - For horizontal expansion (left/right): checks if blocker overlaps in y-axis
 *    - If blocking, calculates distance to the blocker and takes the minimum
 *
 * 4. **Returns** the minimum distance (clamped to non-negative)
 *
 * **Usage:**
 * Called during expansion planning to evaluate potential expansion directions.
 * The result is then clamped by `calculateMaxExpansion()` to respect aspect ratio
 * constraints before actually expanding the node.
 *
 * **Example:**
 * ```
 * Node at (10, 10) with size 5x2mm expanding "right"
 * Board width: 100mm
 * Blocker at (20, 10) with size 3x2mm
 *
 * Initial distance: 100 - (10 + 5) = 85mm
 * Blocker distance: 20 - (10 + 5) = 5mm
 * Returns: 5mm (limited by blocker, not board boundary)
 * ```
 *
 * @param params.node - The gap-fill node to check expansion for
 * @param params.direction - Direction to expand (up/down/left/right)
 * @param ctx - State containing bounds, obstacles, and existing placements
 * @returns Available expansion distance in millimeters (0 if blocked immediately)
 *
 * @internal This is an internal helper function for the edge expansion gap-fill algorithm
 */
export function calculateAvailableSpace(
  params: { node: GapFillNode; direction: Direction },
  ctx: EdgeExpansionGapFillState,
): number {
  const { node, direction } = params
  const { bounds, existingPlacedByLayer, obstacles, nodes, newPlaced } = ctx

  // Get all potential blockers on the same layers
  const blockers: XYRect[] = []

  // Add existing placed rects
  for (const layer of node.zLayers) {
    if (existingPlacedByLayer[layer]) {
      blockers.push(...existingPlacedByLayer[layer]!)
    }
  }

  // Add obstacles
  for (const layer of node.zLayers) {
    if (obstacles[layer]) {
      blockers.push(...obstacles[layer]!)
    }
  }

  // Add other gap-fill nodes (already expanded)
  for (const otherNode of nodes) {
    if (otherNode.id !== node.id) {
      blockers.push(otherNode.rect)
    }
  }

  // Add newly placed rects
  for (const placed of newPlaced) {
    // Check if layers overlap
    const hasCommonLayer = node.zLayers.some((z) => placed.zLayers.includes(z))
    if (hasCommonLayer) {
      blockers.push(placed.rect)
    }
  }

  const rect = node.rect
  let maxDistance = Infinity

  switch (direction) {
    case "up": {
      // Expanding upward (increasing y)
      maxDistance = bounds.y + bounds.height - (rect.y + rect.height)

      for (const obstacle of blockers) {
        // Check if obstacle is above and overlaps in x
        if (
          obstacle.y >= rect.y + rect.height - EPS &&
          !(
            obstacle.x >= rect.x + rect.width - EPS ||
            rect.x >= obstacle.x + obstacle.width - EPS
          )
        ) {
          const dist = obstacle.y - (rect.y + rect.height)
          maxDistance = Math.min(maxDistance, dist)
        }
      }
      break
    }

    case "down": {
      // Expanding downward (decreasing y)
      maxDistance = rect.y - bounds.y

      for (const obstacle of blockers) {
        // Check if obstacle is below and overlaps in x
        if (
          obstacle.y + obstacle.height <= rect.y + EPS &&
          !(
            obstacle.x >= rect.x + rect.width - EPS ||
            rect.x >= obstacle.x + obstacle.width - EPS
          )
        ) {
          const dist = rect.y - (obstacle.y + obstacle.height)
          maxDistance = Math.min(maxDistance, dist)
        }
      }
      break
    }

    case "right": {
      // Expanding rightward (increasing x)
      maxDistance = bounds.x + bounds.width - (rect.x + rect.width)

      for (const obstacle of blockers) {
        // Check if obstacle is to the right and overlaps in y
        if (
          obstacle.x >= rect.x + rect.width - EPS &&
          !(
            obstacle.y >= rect.y + rect.height - EPS ||
            rect.y >= obstacle.y + obstacle.height - EPS
          )
        ) {
          const dist = obstacle.x - (rect.x + rect.width)
          maxDistance = Math.min(maxDistance, dist)
        }
      }
      break
    }

    case "left": {
      // Expanding leftward (decreasing x)
      maxDistance = rect.x - bounds.x

      for (const obstacle of blockers) {
        // Check if obstacle is to the left and overlaps in y
        if (
          obstacle.x + obstacle.width <= rect.x + EPS &&
          !(
            obstacle.y >= rect.y + rect.height - EPS ||
            rect.y >= obstacle.y + obstacle.height - EPS
          )
        ) {
          const dist = rect.x - (obstacle.x + obstacle.width)
          maxDistance = Math.min(maxDistance, dist)
        }
      }
      break
    }
  }

  return Math.max(0, maxDistance)
}
