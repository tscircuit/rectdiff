import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Make a safe copy of a node.
 * Later steps can change the copy without touching the original.
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
