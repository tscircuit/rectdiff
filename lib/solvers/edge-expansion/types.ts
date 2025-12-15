// lib/solvers/edge-expansion/types.ts

export type XYRect = { x: number; y: number; width: number; height: number }

export type Direction = "x+" | "x-" | "y+" | "y-"

export interface CapacityNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  freeDimensions: Direction[]
  done: boolean
  obstacleIndex: number
  nodeType: "edge" | "corner"
}

export interface EdgeExpansionOptions {
  minRequiredExpandSpace: number
}

export type Phase = "EXPANDING" | "DONE"

export interface EdgeExpansionState {
  // Static configuration
  bounds: XYRect
  obstacles: XYRect[]
  options: EdgeExpansionOptions
  minTraceWidth: number // For scaling initial node sizes

  // Dynamic state
  phase: Phase
  nodes: CapacityNode[]
  iteration: number
  
  // Granular stepping state
  currentRound: CapacityNode[] // Sorted candidates for this round
  currentNodeIndex: number // Which node we're processing
  currentDirIndex: number // Which direction of that node we're expanding
  currentNodeId: string | null // ID of node being processed (for visualization)
}

