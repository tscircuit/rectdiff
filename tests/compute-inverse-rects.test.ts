import { expect, test } from "bun:test"
import { computeInverseRects } from "../lib/solvers/RectDiffSeedingSolver/computeInverseRects"
import { containsPoint } from "../lib/utils/rectdiff-geometry"

test("covers the exterior along a diagonal concave outline", () => {
  const bounds = { x: -10, y: -40, width: 50, height: 60 }
  const outline = [
    { x: 40, y: 20 },
    { x: -10, y: 20 },
    { x: -10, y: -40 },
    { x: 10, y: -31 },
    { x: 29, y: -24 },
    { x: 29, y: -29 },
    { x: 40, y: -29 },
  ]

  const boardVoidRects = computeInverseRects(bounds, outline, {
    minGridSize: 0.2,
  })
  const isCoveredByBoardVoid = (point: { x: number; y: number }) =>
    boardVoidRects.some((rect) => containsPoint(rect, point))

  expect(isCoveredByBoardVoid({ x: 28.5, y: -25 })).toBe(true)
  expect(isCoveredByBoardVoid({ x: 28.5, y: -23.5 })).toBe(false)
  expect(isCoveredByBoardVoid({ x: 20, y: -27 })).toBe(false)
})

test("preserves the interior portion of a simplified diagonal boundary cell", () => {
  const bounds = { x: 0, y: 0, width: 10, height: 10 }
  const outline = [
    ...Array.from({ length: 121 }, (_, index) => ({
      x: (index * 10) / 120,
      y: 0,
    })),
    { x: 0, y: 10 },
  ]

  const boardVoidRects = computeInverseRects(bounds, outline, {
    minGridSize: 2,
  })
  const isCoveredByBoardVoid = (point: { x: number; y: number }) =>
    boardVoidRects.some((rect) => containsPoint(rect, point))

  expect(isCoveredByBoardVoid({ x: 4.9, y: 5 })).toBe(false)
  expect(isCoveredByBoardVoid({ x: 7, y: 5 })).toBe(true)
})
