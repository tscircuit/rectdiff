import { expect, test } from "bun:test"
import { EdgeSpatialHashIndex } from "../../lib/solvers/GapFillSolver/EdgeSpatialHashIndex"
import type { SimpleRouteJson } from "../../lib/types/srj-types"
import type { Placed3D } from "../../lib/solvers/rectdiff/types"
import { getSvgFromGraphicsObject } from "graphics-debug"
import testData from "../../lib/solvers/GapFillSolver/test-cases/three-rects-touching.json"

test("Gap Fill: Three rects touching", () => {
  const solver = new EdgeSpatialHashIndex({
    simpleRouteJson: testData.simpleRouteJson as SimpleRouteJson,
    placedRects: testData.placedRects as Placed3D[],
    obstaclesByLayer: testData.obstaclesByLayer,
    maxEdgeDistance: testData.maxEdgeDistance ?? undefined,
  })

  solver.solve()

  expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
