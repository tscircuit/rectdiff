import { expect, test } from "bun:test"
import { GapFillSolver } from "../../lib/solvers/GapFillSolver/GapFillSolver"
import type { SimpleRouteJson } from "../../lib/types/srj-types"
import type { Placed3D } from "../../lib/solvers/rectdiff/types"
import { getSvgFromGraphicsObject } from "graphics-debug"
import testData from "../../lib/solvers/GapFillSolver/test-cases/vertical-and-horizontal-gaps.json"

test("Gap Fill: Vertical and horizontal gaps", () => {
  const solver = new GapFillSolver({
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
