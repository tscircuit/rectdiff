import type { CapacityNode, EdgeExpansionState } from "./types"
import { calculateAvailableSpace } from "./calculateAvailableSpace"

/**
 * Calculate the potential area a node could gain if fully expanded.
 * Used for prioritization.
 */
export function calculatePotentialArea(
  params: { node: CapacityNode },
  ctx: EdgeExpansionState,
): number {
  const { node } = params
  let potentialWidth = node.width
  let potentialHeight = node.height

  for (const direction of node.freeDimensions) {
    const available = calculateAvailableSpace({ node, direction }, ctx)

    switch (direction) {
      case "x+":
      case "x-":
        potentialWidth += available
        break
      case "y+":
      case "y-":
        potentialHeight += available
        break
    }
  }

  return potentialWidth * potentialHeight
}

