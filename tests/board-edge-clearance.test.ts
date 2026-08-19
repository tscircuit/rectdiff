import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { containsPoint } from "../lib/utils/rectdiff-geometry"

test("keeps the physical outline and reserves its board-edge clearance", () => {
  const outline = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  const solver = new RectDiffPipeline({
    simpleRouteJson: {
      layerCount: 2,
      minTraceWidth: 0.1,
      minBoardEdgeClearance: 0.2,
      obstacles: [],
      connections: [],
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      outline,
    },
    maxGapFillPasses: 1,
  })

  solver.solve()

  expect(solver.inputProblem.simpleRouteJson.outline).toBe(outline)
  expect(
    solver.boardVoidRects?.some((rect) =>
      containsPoint(rect, { x: 0.1, y: 5 }),
    ),
  ).toBe(true)
  expect(
    solver.boardVoidRects?.some((rect) =>
      containsPoint(rect, { x: 0.21, y: 5 }),
    ),
  ).toBe(false)
})
