// lib/solvers/rectdiff/edge-expansion-gapfill/mergeAdjacentLayerNodes.ts
import type { GapFillNode } from "./types"

const EPS = 1e-9

/**
 * Try to merge a node with nodes on adjacent layers (z±1).
 * Merges happen when:
 * - Nodes are on consecutive z-indices
 * - They have exact same dimensions (x, y, width, height)
 */
export function mergeAdjacentLayerNodes(params: {
  node: GapFillNode
  allNodes: GapFillNode[]
}): void {
  const { node, allNodes } = params

  // Find nodes that could potentially merge with this node
  const candidatesForMerge = allNodes.filter((other) => {
    if (other.id === node.id) return false
    if (other.obstacleIndex !== node.obstacleIndex) return false
    if (other.direction !== node.direction) return false

    // Check if dimensions match exactly
    const rectMatches =
      Math.abs(other.rect.x - node.rect.x) < EPS &&
      Math.abs(other.rect.y - node.rect.y) < EPS &&
      Math.abs(other.rect.width - node.rect.width) < EPS &&
      Math.abs(other.rect.height - node.rect.height) < EPS

    if (!rectMatches) return false

    // Check if on adjacent layers
    for (const nodeZ of node.zLayers) {
      for (const otherZ of other.zLayers) {
        if (Math.abs(nodeZ - otherZ) === 1) {
          return true
        }
      }
    }

    return false
  })

  // Merge all matching nodes into this node
  for (const candidate of candidatesForMerge) {
    // Combine zLayers
    const combinedLayers = [...node.zLayers, ...candidate.zLayers]
    const uniqueLayers = Array.from(new Set(combinedLayers)).sort(
      (a, b) => a - b,
    )
    node.zLayers = uniqueLayers

    // Update the ID to reflect merged layers
    const layerStr = uniqueLayers.join("_")
    const baseId = node.id.replace(/_z\d+.*$/, "")
    node.id = `${baseId}_z${layerStr}`

    // Mark candidate for removal by clearing its zLayers
    candidate.zLayers = []
  }
}
