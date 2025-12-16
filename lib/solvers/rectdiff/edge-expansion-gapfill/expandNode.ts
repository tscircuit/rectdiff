// lib/solvers/rectdiff/edge-expansion-gapfill/expandNode.ts
import type { GapFillNode, Direction } from "./types"

export function expandNode(params: {
  node: GapFillNode
  direction: Direction
  amount: number
}): void {
  const { node, direction, amount } = params

  switch (direction) {
    case "up":
      node.rect.height += amount
      break
    case "down":
      node.rect.y -= amount
      node.rect.height += amount
      break
    case "right":
      node.rect.width += amount
      break
    case "left":
      node.rect.x -= amount
      node.rect.width += amount
      break
  }
}
