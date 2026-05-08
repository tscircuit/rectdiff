import type { Bounds } from "@tscircuit/math-utils"
import { getBoundFromCenteredRect } from "@tscircuit/math-utils"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

const EPS = 1e-4

export type ClippedNodeBounds = {
  center: { x: number; y: number }
  width: number
  height: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Returns the part of a mesh node that is actually inside the board bounds.
 *
 * In general terms, imagine the node as one rectangle and the board as another.
 * This helper keeps only the overlapping part. If the node is fully inside the
 * board, it returns the original rectangle. If the node sticks out past an edge,
 * it trims off the outside portion. If the node is completely outside the board,
 * it returns `null`.
 */
export const clipNodeToBounds = (
  node: CapacityMeshNode,
  bounds?: Bounds,
): ClippedNodeBounds | null => {
  const nodeBounds = getBoundFromCenteredRect(node)
  if (!bounds) {
    return {
      ...nodeBounds,
      center: node.center,
      width: node.width,
      height: node.height,
    }
  }

  const minX = Math.max(nodeBounds.minX, bounds.minX)
  const maxX = Math.min(nodeBounds.maxX, bounds.maxX)
  const minY = Math.max(nodeBounds.minY, bounds.minY)
  const maxY = Math.min(nodeBounds.maxY, bounds.maxY)
  const width = maxX - minX
  const height = maxY - minY

  if (width <= EPS || height <= EPS) return null

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  }
}
