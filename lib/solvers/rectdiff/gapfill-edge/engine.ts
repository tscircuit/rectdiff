// lib/solvers/rectdiff/gapfill-edge/engine.ts
import type { RectDiffState } from "../types"
import type { EdgeGapFillState } from "./types"
import { extractAllEdges } from "./edges"
import { findNearbyEdges } from "./edges"
import { findUnoccupiedSegments, generateExpansionPoints } from "./segments"
import { expandRectFromSeed } from "../geometry"
import { overlaps } from "../geometry"
import { buildHardPlacedByLayer } from "../engine"

const DEFAULT_MAX_EDGE_DISTANCE = 2.0
const DEFAULT_MIN_SEGMENT_LENGTH = 0.1

/**
 * Initialize edge-based gap fill state.
 */
export function initEdgeGapFillState(state: RectDiffState): EdgeGapFillState {
  const allEdges = extractAllEdges(state.placed)

  return {
    bounds: state.bounds,
    layerCount: state.layerCount,
    obstaclesByLayer: state.obstaclesByLayer,
    placed: state.placed,
    placedByLayer: state.placedByLayer,
    allEdges,
    edgeIndex: 0,
    stage: "SELECT_EDGE",
    primaryEdge: null,
    nearbyEdges: [],
    unoccupiedSegments: [],
    expansionPoints: [],
    expansionPointIndex: 0,
    currentExpandingRect: null,
    maxEdgeDistance: DEFAULT_MAX_EDGE_DISTANCE,
    minSegmentLength: DEFAULT_MIN_SEGMENT_LENGTH,
  }
}

/**
 * Step the edge-based gap fill algorithm.
 * Returns true if still working, false if done.
 * Each step is extremely granular for visualization.
 */
export function stepEdgeGapFill(
  gapFillState: EdgeGapFillState,
  rectDiffState: RectDiffState,
): boolean {
  switch (gapFillState.stage) {
    case "SELECT_EDGE": {
      // Check if we're done with all edges
      if (gapFillState.edgeIndex >= gapFillState.allEdges.length) {
        gapFillState.stage = "DONE"
        return false
      }

      // Select the next primary edge
      const primaryEdge = gapFillState.allEdges[gapFillState.edgeIndex]!
      gapFillState.primaryEdge = primaryEdge
      gapFillState.stage = "FIND_NEARBY"
      return true
    }

    case "FIND_NEARBY": {
      if (!gapFillState.primaryEdge) {
        gapFillState.stage = "SELECT_EDGE"
        return true
      }

      // Find nearby edges
      gapFillState.nearbyEdges = findNearbyEdges(
        gapFillState.primaryEdge,
        gapFillState.allEdges,
        gapFillState.maxEdgeDistance,
      )

      gapFillState.stage = "FIND_SEGMENTS"
      return true
    }

    case "FIND_SEGMENTS": {
      if (!gapFillState.primaryEdge) {
        gapFillState.stage = "SELECT_EDGE"
        return true
      }

      // Get obstacles for the layers of this edge
      const obstacles: Array<{
        x: number
        y: number
        width: number
        height: number
      }> = []
      for (const z of gapFillState.primaryEdge.zLayers) {
        obstacles.push(...(gapFillState.obstaclesByLayer[z] ?? []))
      }

      // Find unoccupied segments
      gapFillState.unoccupiedSegments = findUnoccupiedSegments(
        gapFillState.primaryEdge,
        gapFillState.nearbyEdges,
        obstacles,
        gapFillState.minSegmentLength,
      )

      gapFillState.stage = "GENERATE_POINTS"
      return true
    }

    case "GENERATE_POINTS": {
      if (!gapFillState.primaryEdge) {
        gapFillState.stage = "SELECT_EDGE"
        return true
      }

      // Generate expansion points from unoccupied segments
      gapFillState.expansionPoints = generateExpansionPoints(
        gapFillState.primaryEdge,
        gapFillState.unoccupiedSegments,
        gapFillState.primaryEdge.zLayers,
      )

      gapFillState.expansionPointIndex = 0

      if (gapFillState.expansionPoints.length === 0) {
        // No expansion points, move to next edge
        gapFillState.edgeIndex++
        gapFillState.primaryEdge = null
        gapFillState.nearbyEdges = []
        gapFillState.unoccupiedSegments = []
        gapFillState.stage = "SELECT_EDGE"
        return true
      }

      gapFillState.stage = "EXPAND_FROM_POINT"
      return true
    }

    case "EXPAND_FROM_POINT": {
      if (
        gapFillState.expansionPointIndex >= gapFillState.expansionPoints.length
      ) {
        // Done with all expansion points for this edge, move to next edge
        gapFillState.edgeIndex++
        gapFillState.primaryEdge = null
        gapFillState.nearbyEdges = []
        gapFillState.unoccupiedSegments = []
        gapFillState.expansionPoints = []
        gapFillState.expansionPointIndex = 0
        gapFillState.currentExpandingRect = null
        gapFillState.stage = "SELECT_EDGE"
        return true
      }

      // Try to expand from current expansion point
      const point =
        gapFillState.expansionPoints[gapFillState.expansionPointIndex]!
      const hardPlacedByLayer = buildHardPlacedByLayer(rectDiffState)

      // Get blockers for the layers (all obstacles and hard-placed rects)
      const blockers: Array<{
        x: number
        y: number
        width: number
        height: number
      }> = []
      for (const z of point.zLayers) {
        const obs = rectDiffState.obstaclesByLayer[z] ?? []
        const hard = hardPlacedByLayer[z] ?? []
        blockers.push(...obs, ...hard)
      }

      // Try to expand a rectangle from this point
      const lastGrid =
        rectDiffState.options.gridSizes[
          rectDiffState.options.gridSizes.length - 1
        ]!
      const minSize = Math.min(
        rectDiffState.options.minSingle.width,
        rectDiffState.options.minSingle.height,
      )

      const expanded = expandRectFromSeed({
        startX: point.x,
        startY: point.y,
        gridSize: lastGrid,
        bounds: gapFillState.bounds,
        blockers,
        initialCellRatio: 0.1,
        maxAspectRatio: null,
        minReq: { width: minSize, height: minSize },
      })

      gapFillState.currentExpandingRect = expanded || null

      if (expanded) {
        // Check if it overlaps with existing placed rects on these layers
        let canPlace = true
        for (const z of point.zLayers) {
          const placed = gapFillState.placedByLayer[z] ?? []
          for (const p of placed) {
            if (overlaps(expanded, p)) {
              canPlace = false
              break
            }
          }
          if (!canPlace) break
        }

        if (canPlace) {
          // Place the new rectangle
          const newPlacement = { rect: expanded, zLayers: [...point.zLayers] }
          gapFillState.placed.push(newPlacement)
          for (const z of point.zLayers) {
            gapFillState.placedByLayer[z]!.push(expanded)
          }
          // Update rectDiffState as well
          rectDiffState.placed.push(newPlacement)
          for (const z of point.zLayers) {
            rectDiffState.placedByLayer[z]!.push(expanded)
          }
        }
      }

      gapFillState.expansionPointIndex++
      // Stay in EXPAND_FROM_POINT stage to process next point
      return true
    }

    case "DONE":
      return false

    default:
      gapFillState.stage = "SELECT_EDGE"
      return true
  }
}
