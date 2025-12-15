// lib/solvers/edge-expansion/initialization.ts
import type { XYRect, CapacityNode } from "./types"

/**
 * Creates 8 capacity nodes per obstacle:
 * - 4 edge nodes (top, bottom, left, right)
 * - 4 corner nodes (top-left, top-right, bottom-left, bottom-right)
 * 
 * Nodes start with minimum sizes for visibility (relative to minTraceWidth):
 * - Edge nodes: minTraceWidth thickness in constrained dimension, full obstacle length in free dimension
 * - Corner nodes: minTraceWidth × minTraceWidth starting size
 */
export function createNodesFromObstacles(params: {
  obstacles: XYRect[]
  minTraceWidth: number
}): CapacityNode[] {
  const { obstacles, minTraceWidth } = params
  const nodes: CapacityNode[] = []
  const EDGE_THICKNESS = minTraceWidth * 0.5 // Minimum thickness for edge nodes (relative)
  const CORNER_SIZE = minTraceWidth // Starting size for corner nodes (relative)

  obstacles.forEach((obstacle, idx) => {
    // Top edge node (horizontal line that can expand upward)
    nodes.push({
      x: obstacle.x,
      y: obstacle.y - EDGE_THICKNESS,
      width: obstacle.width,
      height: EDGE_THICKNESS,
      freeDimensions: ["y-"],
      done: false,
      id: `${idx}-top`,
      obstacleIndex: idx,
      nodeType: "edge",
    })

    // Bottom edge node (horizontal line that can expand downward)
    nodes.push({
      x: obstacle.x,
      y: obstacle.y + obstacle.height,
      width: obstacle.width,
      height: EDGE_THICKNESS,
      freeDimensions: ["y+"],
      done: false,
      id: `${idx}-bottom`,
      obstacleIndex: idx,
      nodeType: "edge",
    })

    // Left edge node (vertical line that can expand leftward)
    nodes.push({
      x: obstacle.x - EDGE_THICKNESS,
      y: obstacle.y,
      width: EDGE_THICKNESS,
      height: obstacle.height,
      freeDimensions: ["x-"],
      done: false,
      id: `${idx}-left`,
      obstacleIndex: idx,
      nodeType: "edge",
    })

    // Right edge node (vertical line that can expand rightward)
    nodes.push({
      x: obstacle.x + obstacle.width,
      y: obstacle.y,
      width: EDGE_THICKNESS,
      height: obstacle.height,
      freeDimensions: ["x+"],
      done: false,
      id: `${idx}-right`,
      obstacleIndex: idx,
      nodeType: "edge",
    })

    // Top-left corner node (can expand left and up)
    nodes.push({
      x: obstacle.x - CORNER_SIZE,
      y: obstacle.y - CORNER_SIZE,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      freeDimensions: ["x-", "y-"],
      done: false,
      id: `${idx}-tl`,
      obstacleIndex: idx,
      nodeType: "corner",
    })

    // Top-right corner node (can expand right and up)
    nodes.push({
      x: obstacle.x + obstacle.width,
      y: obstacle.y - CORNER_SIZE,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      freeDimensions: ["x+", "y-"],
      done: false,
      id: `${idx}-tr`,
      obstacleIndex: idx,
      nodeType: "corner",
    })

    // Bottom-left corner node (can expand left and down)
    nodes.push({
      x: obstacle.x - CORNER_SIZE,
      y: obstacle.y + obstacle.height,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      freeDimensions: ["x-", "y+"],
      done: false,
      id: `${idx}-bl`,
      obstacleIndex: idx,
      nodeType: "corner",
    })

    // Bottom-right corner node (can expand right and down)
    nodes.push({
      x: obstacle.x + obstacle.width,
      y: obstacle.y + obstacle.height,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      freeDimensions: ["x+", "y+"],
      done: false,
      id: `${idx}-br`,
      obstacleIndex: idx,
      nodeType: "corner",
    })
  })

  return nodes
}

