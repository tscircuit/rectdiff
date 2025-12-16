// lib/solvers/rectdiff/edge-expansion-gapfill/initState.ts
import type {
  EdgeExpansionGapFillState,
  EdgeExpansionGapFillOptions,
  EdgeExpansionObstacle,
} from "./types"
import type { XYRect, Placed3D } from "../types"

export function initState(params: {
  bounds: XYRect
  layerCount: number
  obstacles: XYRect[][]
  existingPlaced: Placed3D[]
  existingPlacedByLayer: XYRect[][]
  options?: Partial<EdgeExpansionGapFillOptions>
}): EdgeExpansionGapFillState {
  const {
    bounds,
    layerCount,
    obstacles,
    existingPlaced,
    existingPlacedByLayer,
    options = {},
  } = params

  const defaultOptions: EdgeExpansionGapFillOptions = {
    minRequiredExpandSpace: 0.05,
    minSingle: { width: 0.3, height: 0.3 },
    minMulti: { width: 1.2, height: 1.2, minLayers: 2 },
    maxAspectRatio: 3,
    maxMultiLayerSpan: undefined,
    initialEdgeThicknessFactor: 0.01, // 1% of minTraceWidth
    estimatedMinTraceWidthFactor: 0.01, // 1% of board size
  }

  // Build EdgeExpansionObstacle array by grouping obstacles across layers
  // Each unique physical obstacle (identified by exact coordinates) gets one entry
  const obstacleMap = new Map<string, EdgeExpansionObstacle>()

  for (let z = 0; z < layerCount; z++) {
    const layerObstacles = obstacles[z] ?? []
    for (let i = 0; i < layerObstacles.length; i++) {
      const rect = layerObstacles[i]!
      // Use exact coordinates as key to identify same physical obstacle
      const key = `${rect.x},${rect.y},${rect.width},${rect.height}`

      if (obstacleMap.has(key)) {
        // Add this layer to existing obstacle
        obstacleMap.get(key)!.zLayers.push(z)
      } else {
        // Create new obstacle entry
        const center = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }
        obstacleMap.set(key, {
          srjObstacleIndex: i, // Store first index we found (for debugging)
          rect,
          center,
          zLayers: [z],
          area: rect.width * rect.height,
        })
      }
    }
  }

  // Convert to array and sort by area descending (largest first)
  const edgeExpansionObstacles = Array.from(obstacleMap.values())
  edgeExpansionObstacles.sort((a, b) => b.area - a.area)

  return {
    options: { ...defaultOptions, ...options },
    bounds,
    layerCount,
    obstacles,
    edgeExpansionObstacles,
    existingPlaced,
    existingPlacedByLayer,
    phase: "PROCESSING",
    currentObstacleIndex: 0,
    nodes: [],
    currentRound: [],
    currentRoundIndex: 0,
    currentDirection: null,
    currentNodeId: null,
    newPlaced: [],
  }
}
