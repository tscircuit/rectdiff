import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffPipeline } from "../../lib/RectDiffPipeline"
import { buildObstacleIndexesByLayer } from "../../lib/solvers/RectDiffGridSolverPipeline/buildObstacleIndexes"
import { RectDiffSeedingSolver } from "../../lib/solvers/RectDiffSeedingSolver/RectDiffSeedingSolver"
import type { SimpleRouteJson } from "../../lib/types/srj-types"
import board109Outline from "../../test-assets/board109-outline.json"

/** Capture the native void-mask visualization before any grid placements. */
export function getBoard109OutlineSnapshot(): string {
  const simpleRouteJson: SimpleRouteJson = {
    ...board109Outline,
    layerCount: 2,
    obstacles: [],
    connections: [],
  }
  const pipeline = new RectDiffPipeline({
    simpleRouteJson,
    maxGapFillPasses: 1,
  })
  pipeline.setup()

  // Use the pipeline's actual board-edge clearance padding, including the
  // overlapping blockers produced by the original floating-point slivers.
  const boardVoidRects = pipeline.boardVoidRects
  if (!boardVoidRects) {
    throw new Error("Board109 did not generate an outline void mask")
  }
  const solver = new RectDiffSeedingSolver({
    simpleRouteJson,
    boardVoidRects,
    ...buildObstacleIndexesByLayer({ srj: simpleRouteJson, boardVoidRects }),
  })
  solver.setup()

  return getSvgFromGraphicsObject(solver.visualize(), {
    backgroundColor: "white",
    includeTextLabels: false,
    svgWidth: 800,
    svgHeight: 800,
  })
}
