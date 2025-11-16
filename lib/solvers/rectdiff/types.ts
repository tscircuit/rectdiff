// lib/solvers/rectdiff/types.ts
import type { SimpleRouteJson } from "../../types/srj-types"

export type XYRect = { x: number; y: number; width: number; height: number }

export type Rect3d = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  zLayers: number[] // sorted contiguous integers
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

export type Candidate3D = { x: number; y: number; z: number; distance: number }
export type Placed3D = { rect: XYRect; zLayers: number[] }

export type Phase = "GRID" | "EXPANSION" | "DONE"

export type RectDiffState = {
  // static
  srj: SimpleRouteJson
  layerNames: string[]
  layerCount: number
  bounds: XYRect
  options: Required<Omit<GridFill3DOptions, "gridSizes">> & { gridSizes: number[] }
  obstaclesByLayer: XYRect[][]

  // evolving
  phase: Phase
  gridIndex: number // index in gridSizes
  candidates: Candidate3D[]
  placed: Placed3D[]
  placedByLayer: XYRect[][]
  expansionIndex: number

  // progress bookkeeping
  totalSeedsThisGrid: number
  consumedSeedsThisGrid: number
}
