// lib/solvers/rectdiff/gapfill/types.ts
import type { XYRect } from "../types"

/**
 * Context for layer-based operations shared across utility functions.
 * Used by calculateCoverage and findUncoveredPoints.
 */
export interface LayerContext {
  bounds: XYRect
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
}
