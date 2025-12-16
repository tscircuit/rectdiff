// lib/solvers/rectdiff/edge-expansion-gapfill/types.ts
import type { XYRect, Placed3D } from "../types"

export type Direction = "up" | "down" | "left" | "right"

/**
 * Represents a unique physical obstacle with layer information.
 * This ensures each physical obstacle is tracked consistently across layers.
 */
export type EdgeExpansionObstacle = {
  /** Original index in the SRJ obstacles array (for reference/debugging) */
  srjObstacleIndex: number
  /** The actual rectangle (x, y, width, height) */
  rect: XYRect
  /** Computed center for easy access */
  center: { x: number; y: number }
  /** Which z-layers this obstacle exists on */
  zLayers: number[]
  /** Area for sorting (larger obstacles first) */
  area: number
}

export type GapFillNode = {
  id: string
  rect: XYRect
  zLayers: number[]
  direction: Direction
  obstacleIndex: number
  canExpand: boolean
  hasEverExpanded: boolean
}

export type EdgeExpansionGapFillOptions = {
  minRequiredExpandSpace: number
  minSingle: { width: number; height: number }
  minMulti: { width: number; height: number; minLayers: number }
  maxAspectRatio: number | null
  maxMultiLayerSpan: number | undefined
  /**
   * Starting width of seed rectangles placed around component edges, as a fraction of minTraceWidth.
   * These tiny seed rects expand to fill available routing space. Smaller values = finer initial placement.
   * Default: 0.01 (1% of minTraceWidth, typically ~0.0015mm for 0.15mm traces)
   */
  initialEdgeThicknessFactor: number
  /**
   * Estimated minimum trace width as a fraction of board size (min(width, height)).
   * Used to calculate initial edge node thickness when actual minTraceWidth isn't available.
   * Typical PCB trace widths are 0.1-0.2mm, and boards are often 50-200mm, so 1% is a reasonable estimate.
   * Default: 0.01 (1% of board size, e.g., ~1mm for a 100mm board)
   */
  estimatedMinTraceWidthFactor: number
}

export type Phase = "PROCESSING" | "DONE"

/**
 * Internal processing sub-phases for the step expansion algorithm
 */
export type ProcessingPhase =
  | "INIT_NODES" // Creating initial seed nodes for current obstacle
  | "PLAN_ROUND" // Calculating expansion candidates for the round
  | "CHOOSE_DIRECTION" // Selecting best expansion direction for current node
  | "EXPAND_NODE" // Performing the actual expansion
  | "FINALIZE_OBSTACLE" // Merging and finalizing nodes when obstacle is done

export type EdgeExpansionGapFillState = {
  // Configuration
  options: EdgeExpansionGapFillOptions
  bounds: XYRect
  layerCount: number

  // Input data
  obstacles: XYRect[][] // Keep for per-layer overlap checking
  edgeExpansionObstacles: EdgeExpansionObstacle[] // Sorted by size, largest first
  existingPlaced: Placed3D[]
  existingPlacedByLayer: XYRect[][]

  // Current state
  phase: Phase
  processingPhase: ProcessingPhase // Internal state machine phase
  currentObstacleIndex: number // Index into edgeExpansionObstacles array
  nodes: GapFillNode[]
  currentRound: GapFillNode[]
  currentRoundIndex: number
  currentDirection: Direction | null
  currentNodeId: string | null

  // Output
  newPlaced: Placed3D[]
}
