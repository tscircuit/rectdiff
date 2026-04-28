import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Clone a node before sparse promotion mutates its geometry.
 * The solver stages share node arrays, so this prevents accidental aliasing.
 */
export const cloneNode = ({
  node,
}: {
  node: CapacityMeshNode
}): CapacityMeshNode => ({
  ...node,
  center: { ...node.center },
  availableZ: [...node.availableZ],
})
