import type { EdgeExpansionState } from "./types"
import { calculateAvailableSpace } from "./calculateAvailableSpace"
import { calculatePotentialArea } from "./calculatePotentialArea"
import { expandNode } from "./expandNode"

/**
 * Perform one granular step of the expansion algorithm.
 * Each step expands ONE node in ONE direction.
 * Returns true if work was done, false if complete.
 */
export function stepExpansion(state: EdgeExpansionState): boolean {
  if (state.phase === "DONE") {
    return false
  }

  const { bounds, obstacles, options, nodes } = state
  const { minRequiredExpandSpace } = options

  // Step 1: Check if we need to start a new round
  if (
    state.currentRound.length === 0 ||
    state.currentNodeIndex >= state.currentRound.length
  ) {
    // Start new round: identify all expandable nodes
    const expandableNodes = nodes.filter((node) => {
      if (node.done) return false

      // Check if any dimension can expand
      for (const direction of node.freeDimensions) {
        const available = calculateAvailableSpace(
          { node, direction },
          state,
        )
        if (available >= minRequiredExpandSpace) {
          return true
        }
      }

      return false
    })

    // If no expandable nodes, we're done
    if (expandableNodes.length === 0) {
      state.phase = "DONE"
      state.currentNodeId = null
      return false
    }

    // Sort by potential area (largest first for priority)
    expandableNodes.sort((nodeA, nodeB) => {
      const areaA = calculatePotentialArea({ node: nodeA }, state)
      const areaB = calculatePotentialArea({ node: nodeB }, state)
      return areaB - areaA
    })

    // Set up new round
    state.currentRound = expandableNodes
    state.currentNodeIndex = 0
    state.currentDirIndex = 0
  }

  // Step 2: Get current node and direction
  const currentRoundNode = state.currentRound[state.currentNodeIndex]!
  
  // Find the actual node in state.nodes (since it may have been updated)
  const nodeIndex = nodes.findIndex((node) => node.id === currentRoundNode.id)
  if (nodeIndex === -1) {
    // Node was removed somehow, skip to next
    state.currentNodeIndex++
    return true
  }

  const node = nodes[nodeIndex]!
  state.currentNodeId = node.id

  // Check if we've processed all directions for this node
  if (state.currentDirIndex >= node.freeDimensions.length) {
    // Move to next node
    state.currentNodeIndex++
    state.currentDirIndex = 0
    state.iteration++
    return true
  }

  // Step 3: Get current direction to expand
  const direction = node.freeDimensions[state.currentDirIndex]!

  // Step 4: Calculate available space in this direction
  const available = calculateAvailableSpace({ node, direction }, state)

  // Step 5: Expand if there's enough space
  if (available >= minRequiredExpandSpace) {
    const expandedNode = expandNode({ node, direction, amount: available })
    nodes[nodeIndex] = expandedNode
  }
  // If no space available, skip this direction (no wasted steps)

  // Step 6: Advance to next direction
  state.currentDirIndex++

  // Step 7: If done with all directions, check if node should be marked done
  if (state.currentDirIndex >= node.freeDimensions.length) {
    // Check if node can still expand in any direction
    let canStillExpand = false
    for (const direction of node.freeDimensions) {
      const available = calculateAvailableSpace(
        { node: nodes[nodeIndex]!, direction },
        state,
      )
      if (available >= minRequiredExpandSpace) {
        canStillExpand = true
        break
      }
    }

    if (!canStillExpand) {
      nodes[nodeIndex]!.done = true
    }

    // Move to next node
    state.currentNodeIndex++
    state.currentDirIndex = 0
  }

  state.iteration++
  return true
}

