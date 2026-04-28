import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { XYRect } from "../../rectdiff-types"
import type { SimpleRouteJson } from "../../types/srj-types"

export type SparseMultilayerPromotionInput = {
  meshNodes: CapacityMeshNode[]
  simpleRouteJson: SimpleRouteJson
}

export type PromotionCandidate = {
  rect: XYRect
  sourceNode: CapacityMeshNode
  targetNode: CapacityMeshNode
  unionZ: number[]
  area: number
}

export type CoalesceCandidate = {
  rect: XYRect
  absorbedNodes: CapacityMeshNode[]
  score: number
}
