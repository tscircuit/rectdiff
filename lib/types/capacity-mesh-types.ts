import type { XYRect } from "../rectdiff-types"

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
  /** Connection names shared by every available layer of an obstacle node. */
  _connectedTo?: string[]
  /** Exact obstacle connection names for each available z-layer. */
  _connectedToByZ?: Record<number, string[]>
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
  zLayers: number[]
}
