import { expect, spyOn, test } from "bun:test"
import RBush from "rbush"
import type { RTreeRect } from "../lib/types/capacity-mesh-types"
import { expandRectFromSeed } from "../lib/utils/expandRectFromSeed"
import { rectToTree } from "../lib/utils/rectToTree"

test("expansion reuses blockers across strategies without changing the rectangle", () => {
  const obstacles = [
    { x: 0, y: 0, width: 10, height: 2 },
    { x: 0, y: 8, width: 10, height: 2 },
    { x: 0, y: 2, width: 2, height: 6 },
    { x: 8, y: 2, width: 2, height: 6 },
  ]
  const obstacleIndexByLayer = Array.from({ length: 2 }, () =>
    new RBush<RTreeRect>().load(
      obstacles.map((rect) => rectToTree(rect, { zLayers: [0, 1] })),
    ),
  )
  const search = spyOn(obstacleIndexByLayer[0]!, "search")

  const rectangle = expandRectFromSeed({
    startX: 5,
    startY: 5,
    gridSize: 2,
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    obsticalIndexByLayer: obstacleIndexByLayer,
    placedIndexByLayer: [new RBush<RTreeRect>(), new RBush<RTreeRect>()],
    initialCellRatio: 0.2,
    maxAspectRatio: 3,
    minReq: { width: 1, height: 1 },
    zLayers: [0, 1],
  })

  expect(rectangle).toEqual({ x: 2, y: 2, width: 6, height: 6 })
  // The same five strategies previously performed 80 searches per layer.
  expect(search.mock.calls.length).toBeLessThan(15)

  // Every search must add a region not covered by a completed query.
  const queries = search.mock.calls.map(([query]) => query)
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]!
    expect(
      queries
        .slice(0, i)
        .some(
          (previous) =>
            previous.minX <= query.minX &&
            previous.minY <= query.minY &&
            previous.maxX >= query.maxX &&
            previous.maxY >= query.maxY,
        ),
    ).toBe(false)
  }
})
