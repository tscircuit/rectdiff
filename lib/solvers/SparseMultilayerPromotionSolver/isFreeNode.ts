import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Check whether a node is routable free space.
 * Sparse promotion only merges free nodes and never touches targets/obstacles.
 */
export const isFreeNode = ({ node }: { node: CapacityMeshNode }) =>
  !node._containsObstacle && !node._containsTarget
