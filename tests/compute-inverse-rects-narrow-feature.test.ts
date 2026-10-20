import { expect, test } from "bun:test"
import { computeInverseRects } from "../lib/solvers/RectDiffSeedingSolver/computeInverseRects"
import { containsPoint } from "../lib/utils/rectdiff-geometry"

test("coordinate deduplication retains a real narrow notch", () => {
  const outline = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 5.000001, y: 10 },
    { x: 5.000001, y: 5 },
    { x: 5, y: 5 },
    { x: 5, y: 10 },
    { x: 0, y: 10 },
  ]
  const rects = computeInverseRects(
    { x: 0, y: 0, width: 10, height: 10 },
    outline,
  )
  expect(
    rects.some((rect) => containsPoint(rect, { x: 5.0000005, y: 8 })),
  ).toBe(true)
  expect(rects.some((rect) => containsPoint(rect, { x: 4.999, y: 8 }))).toBe(
    false,
  )
  expect(rects.some((rect) => containsPoint(rect, { x: 5.001, y: 8 }))).toBe(
    false,
  )
})
