import { expect, test } from "bun:test"
import { EdgeSpatialHashIndex } from "../../lib/solvers/GapFillSolver/EdgeSpatialHashIndex"
import type { SimpleRouteJson } from "../../lib/types/srj-types"
import type { Placed3D } from "../../lib/solvers/rectdiff/types"
import { getSvgFromGraphicsObject } from "graphics-debug"
import testData from "../../lib/solvers/GapFillSolver/test-cases/simple-two-rect-with-gap.json"

test("Gap Fill: Simple two rects with gap", () => {
  const solver = new EdgeSpatialHashIndex({
    simpleRouteJson: testData.simpleRouteJson as SimpleRouteJson,
    placedRects: testData.placedRects as Placed3D[],
    obstaclesByLayer: testData.obstaclesByLayer,
    maxEdgeDistance: testData.maxEdgeDistance ?? undefined,
  })

  let steps = 0
  while (!solver.solved && steps < 1000) {
    solver._step()
    steps++
  }

  expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
