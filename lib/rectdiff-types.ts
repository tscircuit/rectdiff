// lib/solvers/rectdiff/types.ts
export type XYRect = { x: number; y: number; width: number; height: number }

export type Rect3d = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  zLayers: number[] // sorted contiguous integers
  isObstacle?: boolean
}

export type GridFill3DOptions = {
  gridSizes?: number[]
  initialCellRatio?: number
  maxAspectRatio?: number | null
  minSingle: { width: number; height: number }
  minMulti: { width: number; height: number; minLayers: number }
  preferMultiLayer?: boolean
  maxMultiLayerSpan?: number
}

export type Candidate3D = {
  x: number
  y: number
  z: number
  distance: number
  /** Larger values mean more multi-layer potential at this seed. */
  zSpanLen?: number
  /** Marked when the seed came from the edge analysis pass. */
  isEdgeSeed?: boolean
}
export type Placed3D = { rect: XYRect; zLayers: number[] }
