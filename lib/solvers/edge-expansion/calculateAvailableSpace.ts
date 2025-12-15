import type { CapacityNode, Direction, EdgeExpansionState } from "./types"
import { EPS } from "../rectdiff/geometry"

/**
 * Calculate available space for a node to expand in a specific direction.
 * Takes into account global bounds, obstacles, and other expanded nodes.
 */
export function calculateAvailableSpace(
  params: { node: CapacityNode; direction: Direction },
  ctx: EdgeExpansionState,
): number {
  const { node, direction } = params
  const { bounds, obstacles, nodes: allNodes } = ctx
  let maxDistance = 0

  switch (direction) {
    case "x+": {
      // Right expansion
      maxDistance = bounds.x + bounds.width - (node.x + node.width)

      // Check obstacles
      for (const obstacle of obstacles) {
        // Only consider obstacles that vertically overlap
        if (node.y < obstacle.y + obstacle.height - EPS && node.y + node.height > obstacle.y + EPS) {
          if (obstacle.x >= node.x + node.width - EPS) {
            maxDistance = Math.min(maxDistance, obstacle.x - (node.x + node.width))
          }
        }
      }

      // Check other expanded nodes (that have non-zero area)
      for (const otherNode of allNodes) {
        if (
          otherNode.id !== node.id &&
          otherNode.width > EPS &&
          otherNode.height > EPS
        ) {
          // Vertically overlaps
          if (node.y < otherNode.y + otherNode.height - EPS && node.y + node.height > otherNode.y + EPS) {
            if (otherNode.x >= node.x + node.width - EPS) {
              maxDistance = Math.min(maxDistance, otherNode.x - (node.x + node.width))
            }
          }
        }
      }
      break
    }

    case "x-": {
      // Left expansion
      maxDistance = node.x - bounds.x

      // Check obstacles
      for (const obstacle of obstacles) {
        if (node.y < obstacle.y + obstacle.height - EPS && node.y + node.height > obstacle.y + EPS) {
          if (obstacle.x + obstacle.width <= node.x + EPS) {
            maxDistance = Math.min(maxDistance, node.x - (obstacle.x + obstacle.width))
          }
        }
      }

      // Check other expanded nodes
      for (const otherNode of allNodes) {
        if (
          otherNode.id !== node.id &&
          otherNode.width > EPS &&
          otherNode.height > EPS
        ) {
          if (node.y < otherNode.y + otherNode.height - EPS && node.y + node.height > otherNode.y + EPS) {
            if (otherNode.x + otherNode.width <= node.x + EPS) {
              maxDistance = Math.min(maxDistance, node.x - (otherNode.x + otherNode.width))
            }
          }
        }
      }
      break
    }

    case "y+": {
      // Down expansion
      maxDistance = bounds.y + bounds.height - (node.y + node.height)

      // Check obstacles
      for (const obstacle of obstacles) {
        if (node.x < obstacle.x + obstacle.width - EPS && node.x + node.width > obstacle.x + EPS) {
          if (obstacle.y >= node.y + node.height - EPS) {
            maxDistance = Math.min(maxDistance, obstacle.y - (node.y + node.height))
          }
        }
      }

      // Check other expanded nodes
      for (const otherNode of allNodes) {
        if (
          otherNode.id !== node.id &&
          otherNode.width > EPS &&
          otherNode.height > EPS
        ) {
          if (node.x < otherNode.x + otherNode.width - EPS && node.x + node.width > otherNode.x + EPS) {
            if (otherNode.y >= node.y + node.height - EPS) {
              maxDistance = Math.min(maxDistance, otherNode.y - (node.y + node.height))
            }
          }
        }
      }
      break
    }

    case "y-": {
      // Up expansion
      maxDistance = node.y - bounds.y

      // Check obstacles
      for (const obstacle of obstacles) {
        if (node.x < obstacle.x + obstacle.width - EPS && node.x + node.width > obstacle.x + EPS) {
          if (obstacle.y + obstacle.height <= node.y + EPS) {
            maxDistance = Math.min(maxDistance, node.y - (obstacle.y + obstacle.height))
          }
        }
      }

      // Check other expanded nodes
      for (const otherNode of allNodes) {
        if (
          otherNode.id !== node.id &&
          otherNode.width > EPS &&
          otherNode.height > EPS
        ) {
          if (node.x < otherNode.x + otherNode.width - EPS && node.x + node.width > otherNode.x + EPS) {
            if (otherNode.y + otherNode.height <= node.y + EPS) {
              maxDistance = Math.min(maxDistance, node.y - (otherNode.y + otherNode.height))
            }
          }
        }
      }
      break
    }
  }

  return Math.max(0, maxDistance)
}

