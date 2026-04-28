import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Check whether a node is plain free space.
 * Obstacles and targets are excluded.
 */
export const isFreeNode = ({ node }: { node: CapacityMeshNode }) =>
  !node._containsObstacle && !node._containsTarget
