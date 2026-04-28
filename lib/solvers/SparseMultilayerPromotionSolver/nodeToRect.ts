import type { XYRect } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Convert a capacity node into its rectangle form.
 * This keeps all sparse promotion geometry working on a common shape type.
 */
export const nodeToRect = ({ node }: { node: CapacityMeshNode }): XYRect => ({
  x: node.center.x - node.width / 2,
  y: node.center.y - node.height / 2,
  width: node.width,
  height: node.height,
})
