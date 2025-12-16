// lib/solvers/rectdiff/edge-expansion-gapfill/createNodesFromObstacle.ts
import type { XYRect } from "../types"
import type { GapFillNode } from "./types"
import { overlaps } from "../geometry"

export function createNodesFromObstacle(params: {
  obstacle: XYRect
  obstacleIndex: number
  layerCount: number
  obstaclesByLayer: XYRect[][]
  minTraceWidth: number
  initialEdgeThicknessFactor?: number
}): GapFillNode[] {
  const {
    obstacle,
    obstacleIndex,
    layerCount,
    obstaclesByLayer,
    minTraceWidth,
    initialEdgeThicknessFactor = 0.01,
  } = params

  const EDGE_THICKNESS = minTraceWidth * initialEdgeThicknessFactor

  const nodes: GapFillNode[] = []

  // Define the 4 edge positions
  const positions = [
    {
      name: "top",
      rect: {
        x: obstacle.x,
        y: obstacle.y + obstacle.height,
        width: obstacle.width,
        height: EDGE_THICKNESS,
      },
      direction: "up" as const,
    },
    {
      name: "bottom",
      rect: {
        x: obstacle.x,
        y: obstacle.y - EDGE_THICKNESS,
        width: obstacle.width,
        height: EDGE_THICKNESS,
      },
      direction: "down" as const,
    },
    {
      name: "right",
      rect: {
        x: obstacle.x + obstacle.width,
        y: obstacle.y,
        width: EDGE_THICKNESS,
        height: obstacle.height,
      },
      direction: "right" as const,
    },
    {
      name: "left",
      rect: {
        x: obstacle.x - EDGE_THICKNESS,
        y: obstacle.y,
        width: EDGE_THICKNESS,
        height: obstacle.height,
      },
      direction: "left" as const,
    },
  ]

  // For each position, create a single-layer node for each layer
  for (const position of positions) {
    for (let z = 0; z < layerCount; z++) {
      // Check if this position is blocked by an obstacle on this layer
      let isBlocked = false

      if (obstaclesByLayer[z]) {
        for (const obs of obstaclesByLayer[z]!) {
          if (overlaps(position.rect, obs)) {
            isBlocked = true
            break
          }
        }
      }

      // Only create node if not blocked
      if (!isBlocked) {
        nodes.push({
          id: `obs${obstacleIndex}_${position.name}_z${z}`,
          rect: { ...position.rect },
          zLayers: [z],
          direction: position.direction,
          obstacleIndex,
          canExpand: true,
          hasEverExpanded: false,
        })
      }
    }
  }

  return nodes
}
