import type { XYRect } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { getZLayerName } from "../../math/layers/getZLayerName"

/**
 * Clone a node while replacing its rectangle and optional z-span.
 * This is the common constructor for promoted, residual, and coalesced nodes.
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
