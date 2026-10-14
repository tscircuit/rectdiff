import { expect, test } from "bun:test"
import inputProblems from "./rectdiff-grid-pipeline-input.json"
import {
  getBounds,
  getSvgFromGraphicsObject,
  mergeGraphics,
  stackGraphicsVertically,
  type GraphicsObject,
  type Rect,
} from "graphics-debug"
import {
  RectDiffGridSolverPipeline,
  type RectDiffGridSolverPipelineInput,
} from "lib/solvers/RectDiffGridSolverPipeline/RectDiffGridSolverPipeline"
import type { SimpleRouteJson } from "lib/types/srj-types"
import { makeCapacityMeshNodeWithLayerInfo } from "tests/fixtures/makeCapacityMeshNodeWithLayerInfo"
import { makeSimpleRouteOutlineGraphics } from "tests/fixtures/makeSimpleRouteOutlineGraphics"

const rawProblem = inputProblems[0]!

function normalizeProblem(
  problem: typeof rawProblem,
): RectDiffGridSolverPipelineInput {
  const zIndexEntries = Object.entries(problem.zIndexByName ?? {}).map(
    ([layerName, zIndex]) => [layerName, Number(zIndex)] as const,
  )

  return {
    ...problem,
    zIndexByName: new Map(zIndexEntries),
  } as RectDiffGridSolverPipelineInput
}

function toSimpleRouteJson(
  problem: RectDiffGridSolverPipelineInput,
): SimpleRouteJson {
  return {
    bounds: problem.bounds,
    obstacles: problem.obstacles,
    connections: problem.connections,
    outline: problem.outline?.outline,
    layerCount: problem.layerCount,
    minTraceWidth: problem.minTraceWidth,
  }
}

test("rectdiff grid pipeline captured input repro snapshot", async () => {
  const problem = normalizeProblem(rawProblem)
  const simpleRouteJson = toSimpleRouteJson(problem)
  const solver = new RectDiffGridSolverPipeline(problem)
  const outline = makeSimpleRouteOutlineGraphics(simpleRouteJson)

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const rectsByCombo = makeCapacityMeshNodeWithLayerInfo(meshNodes)
  const allGraphicsObjects: GraphicsObject[] = []

  for (let z = 0; z < problem.layerCount; z++) {
    const layerRects: Rect[] = []

    for (const [key, rects] of rectsByCombo) {
      const layers = key
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => !Number.isNaN(value))

      if (layers.includes(z)) {
        layerRects.push(...rects)
      }
    }

    let labelY = 0

    if (layerRects.length > 0) {
      let maxY = -Infinity

      for (const rect of layerRects) {
        const top = rect.center.y + rect.height * (2 / 3)

        if (top > maxY) maxY = top
      }

      labelY = maxY
    }

    const graphics: GraphicsObject = {
      title: `RectDiffGridSolverPipeline - z${z}`,
      texts: [
        {
          anchorSide: "top_right",
          text: `Layer z=${z}`,
          x: 0,
          y: labelY,
          fontSize: 0.5,
        },
      ],
      coordinateSystem: "cartesian",
      rects: layerRects,
      points: [],
      lines: [],
    }

    allGraphicsObjects.push(mergeGraphics(graphics, outline))
  }

  const stackedGraphics = stackGraphicsVertically(allGraphicsObjects)
  const bounds = getBounds(stackedGraphics)
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY)
  const svgWidth = 640
  const svgHeight = Math.max(
    svgWidth,
    Math.ceil((boundsHeight / boundsWidth) * svgWidth),
  )

  const svg = getSvgFromGraphicsObject(stackedGraphics, {
    svgWidth,
    svgHeight,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
