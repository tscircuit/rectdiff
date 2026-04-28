import { subtractRect2D } from "../../utils/rectdiff-geometry"
import type {
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "../../types/capacity-mesh-types"
import type { XYRect } from "../../rectdiff-types"
import { cloneNodeWithRect } from "./cloneNodeWithRect"

/**
 * Cut one rectangle out of a node and return the remaining pieces.
 * Each remaining piece is turned back into a node.
 */
export const createResidualNodes = ({
  cutRect,
  getNextResidualId,
  idPrefix,
  node,
  onResidualNodeIdCreated,
}: {
  cutRect: XYRect
  getNextResidualId: () => number
  idPrefix: string
  node: CapacityMeshNode
  onResidualNodeIdCreated: (nodeId: CapacityMeshNodeId) => void
}) =>
  subtractRect2D(
    {
      x: node.center.x - node.width / 2,
      y: node.center.y - node.height / 2,
      width: node.width,
      height: node.height,
    },
    cutRect,
  ).map((rect) => {
    const residualNode = cloneNodeWithRect({
      templateNode: node,
      rect,
      capacityMeshNodeId: `${idPrefix}-${getNextResidualId()}`,
    })
    onResidualNodeIdCreated(residualNode.capacityMeshNodeId)
    return residualNode
  })
