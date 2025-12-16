// lib/solvers/rectdiff/edge-expansion-gapfill/createNodesFromObstacle.ts
import type { XYRect } from "../types"
import type { GapFillNode } from "./types"
import { overlaps } from "../geometry"

/**
 * Create initial seed nodes around an obstacle for gap-fill expansion.
 *
 * **What it does:**
 * Generates tiny seed rectangles at each of the 4 edges (top, bottom, left, right)
 * of an obstacle. These seed nodes will later expand outward to fill available
 * routing space around the obstacle. Creates one node per edge position per layer,
 * but only if the position isn't blocked by another obstacle on that layer.
 *
 * **How it works:**
 * 1. **Defines 4 edge positions** around the obstacle:
 *    - Top: Above the obstacle, same width, very thin height
 *    - Bottom: Below the obstacle, same width, very thin height
 *    - Right: To the right, same height, very thin width
 *    - Left: To the left, same height, very thin width
 *
 * 2. **For each position and each layer:**
 *    - Checks if the position overlaps with any obstacle on that layer
 *    - If blocked, skips creating a node for that position/layer combination
 *    - If not blocked, creates a single-layer gap-fill node
 *
 * 3. **Node properties:**
 *    - Initial size: Very thin (minTraceWidth × initialEdgeThicknessFactor)
 *    - Direction: Set based on which edge (top→up, bottom→down, etc.)
 *    - Can expand: All nodes start with `canExpand: true`
 *    - Single layer: Each node exists on exactly one z-layer
 *
 * **Why this is needed:**
 * These seed nodes serve as starting points for expansion. They're placed immediately
 * adjacent to obstacles, then expanded outward until they hit blockers (other obstacles,
 * board boundaries, or existing capacity nodes). This fills gaps around components.
 *
 * **Usage:**
 * Called once per obstacle in `stepExpansion()` when starting to process a new obstacle.
 * The returned nodes are then filtered by `filterOverlappingNodes()` to remove any that
 * would immediately overlap with existing capacity nodes before expansion begins.
 *
 * **Example:**
 * ```
 * Obstacle: 10x10mm at (50, 50)
 * minTraceWidth: 0.15mm
 * initialEdgeThicknessFactor: 0.01
 *
 * Creates 4 seed nodes (one per edge):
 * - Top: (50, 60) 10mm wide × 0.0015mm tall, expands upward
 * - Bottom: (50, 49.9985) 10mm wide × 0.0015mm tall, expands downward
 * - Right: (60, 50) 0.0015mm wide × 10mm tall, expands rightward
 * - Left: (49.9985, 50) 0.0015mm wide × 10mm tall, expands leftward
 * ```
 *
 * @param params.obstacle - The obstacle rectangle to create nodes around
 * @param params.obstacleIndex - Index of obstacle in sorted array (used for node IDs)
 * @param params.layerCount - Total number of z-layers on the board
 * @param params.obstaclesByLayer - All obstacles indexed by layer (for overlap checking)
 * @param params.minTraceWidth - Estimated minimum trace width (used to calculate seed thickness)
 * @param params.initialEdgeThicknessFactor - Factor to multiply minTraceWidth for seed thickness
 * @returns Array of seed gap-fill nodes (0-4 nodes per layer, typically 0-16 total for 4 layers)
 *
 * @internal This is an internal helper function for the edge expansion gap-fill algorithm
 */
export function createNodesFromObstacle(params: {
  obstacle: XYRect
  obstacleIndex: number
  layerCount: number
  obstaclesByLayer: XYRect[][]
  minTraceWidth: number
  initialEdgeThicknessFactor?: number
}): GapFillNode[] {
  const {
    obstacle,
    obstacleIndex,
    layerCount,
    obstaclesByLayer,
    minTraceWidth,
    initialEdgeThicknessFactor = 0.01,
  } = params

  const EDGE_THICKNESS = minTraceWidth * initialEdgeThicknessFactor

  const nodes: GapFillNode[] = []

  // Define the 4 edge positions
  const positions = [
    {
      name: "top",
      rect: {
        x: obstacle.x,
        y: obstacle.y + obstacle.height,
        width: obstacle.width,
        height: EDGE_THICKNESS,
      },
      direction: "up" as const,
    },
    {
      name: "bottom",
      rect: {
        x: obstacle.x,
        y: obstacle.y - EDGE_THICKNESS,
        width: obstacle.width,
        height: EDGE_THICKNESS,
      },
      direction: "down" as const,
    },
    {
      name: "right",
      rect: {
        x: obstacle.x + obstacle.width,
        y: obstacle.y,
        width: EDGE_THICKNESS,
        height: obstacle.height,
      },
      direction: "right" as const,
    },
    {
      name: "left",
      rect: {
        x: obstacle.x - EDGE_THICKNESS,
        y: obstacle.y,
        width: EDGE_THICKNESS,
        height: obstacle.height,
      },
      direction: "left" as const,
    },
  ]

  // For each position, create a single-layer node for each layer
  for (const position of positions) {
    for (let z = 0; z < layerCount; z++) {
      // Check if this position is blocked by an obstacle on this layer
      let isBlocked = false

      if (obstaclesByLayer[z]) {
        for (const obs of obstaclesByLayer[z]!) {
          if (overlaps(position.rect, obs)) {
            isBlocked = true
            break
          }
        }
      }

      // Only create node if not blocked
      if (!isBlocked) {
        nodes.push({
          id: `obs${obstacleIndex}_${position.name}_z${z}`,
          rect: { ...position.rect },
          zLayers: [z],
          direction: position.direction,
          obstacleIndex,
          canExpand: true,
          hasEverExpanded: false,
        })
      }
    }
  }

  return nodes
}
