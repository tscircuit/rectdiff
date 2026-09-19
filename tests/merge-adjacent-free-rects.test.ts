import { expect, test } from "bun:test"
import type { Rect3d } from "../lib/rectdiff-types"
import { mergeAdjacentFreeRects } from "../lib/solvers/RectDiffExpansionSolver/mergeAdjacentFreeRects"

const square: Rect3d = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
  zLayers: [0, 2, 3],
}

test("removes a tiled region's internal boundaries without mutating its input", () => {
  const rects = [
    square,
    { ...square, minX: 1, maxX: 2 },
    { ...square, minY: 1, maxY: 2 },
    { ...square, minX: 1, maxX: 2, minY: 1, maxY: 2 },
  ]
  const original = structuredClone(rects)
  const output = mergeAdjacentFreeRects(rects)
  expect(output).toEqual([{ ...square, maxX: 2, maxY: 2 }])
  expect(rects).toEqual(original)
  expect(mergeAdjacentFreeRects(output)).toEqual(output)
})

test("retains layer boundaries, obstacles, owned regions, gaps and partial edges", () => {
  const right = { ...square, minX: 1, maxX: 2 }
  for (const neighbor of [
    { ...right, zLayers: [2, 3] },
    { ...right, isObstacle: true },
    { ...right, connectedTo: ["net"] },
    { ...right, minX: 1 + 1e-10 },
    { ...right, maxY: 0.5 },
  ]) {
    expect(mergeAdjacentFreeRects([square, neighbor])).toEqual([
      square,
      neighbor,
    ])
  }
})
