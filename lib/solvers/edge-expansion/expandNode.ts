import type { CapacityNode, Direction } from "./types"

/**
 * Expand a node in a specific direction by the given amount.
 * Returns a new node with updated geometry.
 */
export function expandNode(params: {
  node: CapacityNode
  direction: Direction
  amount: number
}): CapacityNode {
  const { node, direction, amount } = params
  const expanded = { ...node }

  switch (direction) {
    case "x+":
      expanded.width += amount
      break
    case "x-":
      expanded.x -= amount
      expanded.width += amount
      break
    case "y+":
      expanded.height += amount
      break
    case "y-":
      expanded.y -= amount
      expanded.height += amount
      break
  }

  return expanded
}

