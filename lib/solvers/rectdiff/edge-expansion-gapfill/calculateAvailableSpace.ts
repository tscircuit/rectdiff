// lib/solvers/rectdiff/edge-expansion-gapfill/calculateAvailableSpace.ts
import type { GapFillNode, Direction, EdgeExpansionGapFillState } from "./types"
import type { XYRect } from "../types"

const EPS = 1e-9

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
