// lib/solvers/rectdiff/edge-expansion-gapfill/validateNoOverlaps.ts
import type { GapFillNode, EdgeExpansionGapFillState } from "./types"
import { overlaps } from "../geometry"

/**
 * Strict validation function to ensure no overlaps exist.
 * This should NEVER find overlaps - if it does, it's a bug in the expansion logic.
 * Throws an error if any overlap is detected.
 */
export function validateNoOverlaps(params: {
  nodes: GapFillNode[]
  state: EdgeExpansionGapFillState
}): void {
  const { nodes, state } = params

  for (const node of nodes) {
    // Check each layer the node occupies
    for (const z of node.zLayers) {
      // 1. Check overlap with obstacles on this layer
      if (state.obstacles[z]) {
        for (const obstacle of state.obstacles[z]!) {
          if (overlaps(node.rect, obstacle)) {
            throw new Error(
              `VALIDATION ERROR: Node ${node.id} overlaps with obstacle on layer ${z}. ` +
                `Node: {x:${node.rect.x.toFixed(3)}, y:${node.rect.y.toFixed(3)}, ` +
                `w:${node.rect.width.toFixed(3)}, h:${node.rect.height.toFixed(3)}}. ` +
                `Obstacle: {x:${obstacle.x.toFixed(3)}, y:${obstacle.y.toFixed(3)}, ` +
                `w:${obstacle.width.toFixed(3)}, h:${obstacle.height.toFixed(3)}}`,
            )
          }
        }
      }

      // 2. Check overlap with existing placed capacity nodes on this layer
      if (state.existingPlacedByLayer[z]) {
        for (const existing of state.existingPlacedByLayer[z]!) {
          if (overlaps(node.rect, existing)) {
            throw new Error(
              `VALIDATION ERROR: Node ${node.id} overlaps with existing capacity node on layer ${z}. ` +
                `Node: {x:${node.rect.x.toFixed(3)}, y:${node.rect.y.toFixed(3)}, ` +
                `w:${node.rect.width.toFixed(3)}, h:${node.rect.height.toFixed(3)}}. ` +
                `Existing: {x:${existing.x.toFixed(3)}, y:${existing.y.toFixed(3)}, ` +
                `w:${existing.width.toFixed(3)}, h:${existing.height.toFixed(3)}}`,
            )
          }
        }
      }
    }

    // 3. Check overlap with previously placed gap-fill nodes
    for (const placed of state.newPlaced) {
      // Check if they share any layers
      const sharedLayers = node.zLayers.filter((z) =>
        placed.zLayers.includes(z),
      )

      if (sharedLayers.length > 0) {
        if (overlaps(node.rect, placed.rect)) {
          throw new Error(
            `VALIDATION ERROR: Node ${node.id} overlaps with previously placed gap-fill node on layers ${sharedLayers.join(",")}. ` +
              `Node: {x:${node.rect.x.toFixed(3)}, y:${node.rect.y.toFixed(3)}, ` +
              `w:${node.rect.width.toFixed(3)}, h:${node.rect.height.toFixed(3)}}. ` +
              `Placed: {x:${placed.rect.x.toFixed(3)}, y:${placed.rect.y.toFixed(3)}, ` +
              `w:${placed.rect.width.toFixed(3)}, h:${placed.rect.height.toFixed(3)}}`,
          )
        }
      }
    }

    // 4. Check overlap with other nodes being validated in this batch
    for (const otherNode of nodes) {
      if (node.id === otherNode.id) continue

      // Check if they share any layers
      const sharedLayers = node.zLayers.filter((z) =>
        otherNode.zLayers.includes(z),
      )

      if (sharedLayers.length > 0) {
        if (overlaps(node.rect, otherNode.rect)) {
          throw new Error(
            `VALIDATION ERROR: Node ${node.id} overlaps with node ${otherNode.id} on layers ${sharedLayers.join(",")}. ` +
              `Node1: {x:${node.rect.x.toFixed(3)}, y:${node.rect.y.toFixed(3)}, ` +
              `w:${node.rect.width.toFixed(3)}, h:${node.rect.height.toFixed(3)}}. ` +
              `Node2: {x:${otherNode.rect.x.toFixed(3)}, y:${otherNode.rect.y.toFixed(3)}, ` +
              `w:${otherNode.rect.width.toFixed(3)}, h:${otherNode.rect.height.toFixed(3)}}`,
          )
        }
      }
    }
  }
}
