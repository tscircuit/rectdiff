// lib/solvers/rectdiff/gapfill-edge/types.ts
import type { XYRect, Placed3D } from "../types"

export type EdgeOrientation = "horizontal" | "vertical"

export interface RectEdge {
  /** The rectangle this edge belongs to */
  rect: XYRect
  /** Which edge: "top", "right", "bottom", "left" */
  side: "top" | "right" | "bottom" | "left"
  /** Orientation of the edge */
  orientation: EdgeOrientation
  /** Start point of the edge */
  start: { x: number; y: number }
  /** End point of the edge */
  end: { x: number; y: number }
  /** Z-layers where this edge exists */
  zLayers: number[]
}

export type GapFillStage =
  | "SELECT_EDGE"
  | "FIND_NEARBY"
  | "FIND_SEGMENTS"
  | "GENERATE_POINTS"
  | "EXPAND_FROM_POINT"
  | "DONE"

export interface EdgeGapFillState {
  bounds: XYRect
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placed: Placed3D[]
  placedByLayer: XYRect[][]

  // All edges from placed rectangles
  allEdges: RectEdge[]
  // Current edge index being processed
  edgeIndex: number
  // Current stage in the gap fill process
  stage: GapFillStage
  // Current primary edge being explored
  primaryEdge: RectEdge | null
  // Nearby edges (parallel and close to primary edge)
  nearbyEdges: RectEdge[]
  // Unoccupied segments of the primary edge
  unoccupiedSegments: Array<{ start: number; end: number }>
  // Points to expand from
  expansionPoints: Array<{ x: number; y: number; zLayers: number[] }>
  // Current expansion point index
  expansionPointIndex: number
  // Currently expanding rectangle (for visualization)
  currentExpandingRect: XYRect | null

  // Options
  maxEdgeDistance: number // Maximum distance for "nearby" edges
  minSegmentLength: number // Minimum unoccupied segment length to consider
}
