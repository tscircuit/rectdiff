// lib/solvers/rectdiff/edge-expansion-gapfill/validateInitialNodes.ts
import type { GapFillNode } from "./types"
import type { XYRect } from "../types"
import { overlaps } from "../geometry"

/**
 * Validates that initial nodes do not overlap with their parent obstacles.
 * Throws an error if any overlap is detected.
 */
export function validateInitialNodes(params: {
  nodes: GapFillNode[]
  obstacles: XYRect[][]
}): void {
  const { nodes, obstacles } = params

  for (const node of nodes) {
    // Get the parent obstacle on each layer this node exists on
    for (const layer of node.zLayers) {
      if (!obstacles[layer]) continue

      const parentObstacle = obstacles[layer]![node.obstacleIndex]
      if (!parentObstacle) continue

      // Check if node overlaps with parent obstacle
      if (overlaps(node.rect, parentObstacle)) {
        throw new Error(
          `VALIDATION ERROR: Initial node ${node.id} overlaps with parent obstacle on layer ${layer}. ` +
            `Node: {x:${node.rect.x.toFixed(3)}, y:${node.rect.y.toFixed(3)}, ` +
            `w:${node.rect.width.toFixed(3)}, h:${node.rect.height.toFixed(3)}}. ` +
            `Parent: {x:${parentObstacle.x.toFixed(3)}, y:${parentObstacle.y.toFixed(3)}, ` +
            `w:${parentObstacle.width.toFixed(3)}, h:${parentObstacle.height.toFixed(3)}}`,
        )
      }
    }
  }
}
