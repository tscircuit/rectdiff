import RBush from "rbush"
import type { RectDiffExpansionSolverInput } from "../solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import type { SimpleRouteJson } from "../types/srj-types"
import type { XYRect } from "../rectdiff-types"
import type { RTreeRect } from "lib/types/capacity-mesh-types"

/**
 * Builds a minimal RectDiffExpansionSolver snapshot showing two nodes separated
 * by a central keep-out. This keeps the data close to the solver’s real input
 * shape so we can reuse it in tests and interactive pages.
 */
export const createTwoNodeExpansionInput = (): RectDiffExpansionSolverInput => {
  const srj: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 12, minY: 0, maxY: 4 },
    layerCount: 1,
    minTraceWidth: 0.2,
    obstacles: [],
    connections: [],
  }
  const layerCount = srj.layerCount ?? 1
  const bounds: XYRect = {
    x: srj.bounds.minX,
    y: srj.bounds.minY,
    width: srj.bounds.maxX - srj.bounds.minX,
    height: srj.bounds.maxY - srj.bounds.minY,
  }

  const obstacleIndexByLayer = Array.from(
    { length: layerCount },
    () => new RBush<RTreeRect>(),
  )
  // Start with all-empty obstacle indexes for a "clean" scenario

  return {
    srj,
    layerNames: ["top"],
    layerCount,
    bounds,
    options: { gridSizes: [1] },
    boardVoidRects: [],
    gridIndex: 0,
    candidates: [],
    placed: [
      {
        rect: { x: 0.5, y: 0.5, width: 2, height: 3 },
        zLayers: [0],
      },
      {
        rect: { x: 9.5, y: 0.5, width: 2, height: 3 },
        zLayers: [0],
      },
    ],
    expansionIndex: 0,
    edgeAnalysisDone: true,
    totalSeedsThisGrid: 0,
    consumedSeedsThisGrid: 0,
    obstacleIndexByLayer,
  }
}
