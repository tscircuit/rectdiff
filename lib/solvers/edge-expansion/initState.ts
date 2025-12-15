import type { SimpleRouteJson } from "../../types/srj-types"
import type { EdgeExpansionState, EdgeExpansionOptions, XYRect } from "./types"
import { createNodesFromObstacles } from "./initialization"

/**
 * Initialize the solver state from SimpleRouteJson input
 */
export function initState(
  srj: SimpleRouteJson,
  options: Partial<EdgeExpansionOptions>,
): EdgeExpansionState {
  // Extract obstacles as XYRect
  const obstacles: XYRect[] = (srj.obstacles ?? []).map((obstacle) => ({
    x: obstacle.center.x - obstacle.width / 2,
    y: obstacle.center.y - obstacle.height / 2,
    width: obstacle.width,
    height: obstacle.height,
  }))

  // Create initial nodes (8 per obstacle)
  const nodes = createNodesFromObstacles({
    obstacles,
    minTraceWidth: srj.minTraceWidth,
  })

  // Set up bounds
  const bounds: XYRect = {
    x: srj.bounds.minX,
    y: srj.bounds.minY,
    width: srj.bounds.maxX - srj.bounds.minX,
    height: srj.bounds.maxY - srj.bounds.minY,
  }

  return {
    bounds,
    obstacles,
    options: {
      minRequiredExpandSpace: options.minRequiredExpandSpace ?? 1,
    },
    minTraceWidth: srj.minTraceWidth,
    phase: "EXPANDING",
    nodes,
    iteration: 0,
    currentRound: [],
    currentNodeIndex: 0,
    currentDirIndex: 0,
    currentNodeId: null,
  }
}

