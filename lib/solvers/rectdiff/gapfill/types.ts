// lib/solvers/rectdiff/gapfill/types.ts
import type { XYRect, Placed3D } from "../types"

export interface GapFillOptions {
  /** Minimum width for gap-fill rectangles (can be smaller than main solver) */
  minWidth: number
  /** Minimum height for gap-fill rectangles */
  minHeight: number
  /** Maximum iterations to prevent infinite loops */
  maxIterations: number
  /** Target coverage percentage (0-1) to stop early */
  targetCoverage: number
  /** Grid resolution for gap detection */
  scanResolution: number
}

export interface GapRegion {
  /** Bounding box of the gap */
  rect: XYRect
  /** Z-layers where this gap exists */
  zLayers: number[]
  /** Center point for seeding */
  centerX: number
  centerY: number
  /** Approximate area of the gap */
  area: number
}

export interface GapFillState {
  bounds: XYRect
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placed: Placed3D[]
  placedByLayer: XYRect[][]
  options: GapFillOptions

  // Progress tracking
  iteration: number
  gapsFound: GapRegion[]
  gapIndex: number
  done: boolean

  // Stats
  initialGapCount: number
  filledCount: number

  // Four-stage visualization state
  stage: "scan" | "select" | "expand" | "place"
  currentGap: GapRegion | null
  currentSeed: { x: number; y: number } | null
  expandedRect: XYRect | null
}

/** Context for layer-based operations shared across gap fill functions */
export interface LayerContext {
  bounds: XYRect
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
}
