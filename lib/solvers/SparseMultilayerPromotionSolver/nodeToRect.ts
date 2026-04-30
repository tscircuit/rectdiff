import type { XYRect } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Convert a node into a rectangle.
 * This keeps geometry code simple.
 */
export const nodeToRect = ({ node }: { node: CapacityMeshNode }): XYRect => ({
  x: node.center.x - node.width / 2,
  y: node.center.y - node.height / 2,
  width: node.width,
  height: node.height,
})
