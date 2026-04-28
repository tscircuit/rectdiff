import type { XYRect } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { getZLayerName } from "../../math/layers/getZLayerName"

/**
 * Copy a node and replace its shape.
 * The layer span can also be replaced when needed.
 */
export const cloneNodeWithRect = ({
  rect,
  templateNode,
  availableZ,
  capacityMeshNodeId,
}: {
  availableZ?: number[]
  capacityMeshNodeId: string
  rect: XYRect
  templateNode: CapacityMeshNode
}): CapacityMeshNode => {
  const nextAvailableZ = availableZ ?? templateNode.availableZ

  return {
    ...templateNode,
    capacityMeshNodeId,
    center: {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    },
    width: rect.width,
    height: rect.height,
    availableZ: [...nextAvailableZ],
    layer: getZLayerName({ availableZ: nextAvailableZ }),
  }
}
