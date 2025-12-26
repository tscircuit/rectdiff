import type { XYRect } from "lib/rectdiff-types"

export type CapacityMeshNodeId = string

export interface CapacityMesh {
  nodes: CapacityMeshNode[]
  edges: CapacityMeshEdge[]
}

export interface CapacityMeshNode {
  capacityMeshNodeId: string
  center: { x: number; y: number }
  width: number
  height: number
  layer: string
  availableZ: number[]

  _depth?: number

  _completelyInsideObstacle?: boolean
  _containsObstacle?: boolean
  _containsTarget?: boolean
  _targetConnectionName?: string
  _strawNode?: boolean
  _strawParentCapacityMeshNodeId?: CapacityMeshNodeId

  _adjacentNodeIds?: CapacityMeshNodeId[]

  _parent?: CapacityMeshNode
}

export interface CapacityMeshEdge {
  capacityMeshEdgeId: string
  nodeIds: [CapacityMeshNodeId, CapacityMeshNodeId]
}

export type RTreeRect = XYRect & {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type MightBeFullStackRect = RTreeRect & {
  // if it covers all layers
  isFullStack?: boolean
}
