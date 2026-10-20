import { expect, test } from "bun:test"
import { computeInverseRects } from "../lib/solvers/RectDiffSeedingSolver/computeInverseRects"
import { containsPoint, EPS } from "../lib/utils/rectdiff-geometry"
import board109Outline from "../test-assets/board109-outline.json"
import { getBoard109OutlineSnapshot } from "./fixtures/getBoard109OutlineSnapshot"

// Captured from tscircuit-autorouter's bugreport109-book-reading-clip-lamp.srj.json.
test("board109's circular outline does not generate floating-point sliver blockers", async () => {
  const clearance = board109Outline.minBoardEdgeClearance
  const rects = computeInverseRects(
    {
      x: board109Outline.bounds.minX - clearance,
      y: board109Outline.bounds.minY - clearance,
      width:
        board109Outline.bounds.maxX -
        board109Outline.bounds.minX +
        clearance * 2,
      height:
        board109Outline.bounds.maxY -
        board109Outline.bounds.minY +
        clearance * 2,
    },
    board109Outline.outline,
    { minGridSize: board109Outline.minTraceWidth },
  )

  await expect(getBoard109OutlineSnapshot()).toMatchSvgSnapshot(
    import.meta.path,
  )

  // The original 96-vertex outline generated 19,985 rectangles, including
  // 14,696 thinner than EPS. A compact perimeter decomposition is sufficient.
  expect(rects.length).toBeLessThan(512)
  expect(rects.every((rect) => rect.width > EPS && rect.height > EPS)).toBe(
    true,
  )

  for (let index = 0; index < 96; index++) {
    const angle = (index * Math.PI * 2) / 96
    const exterior = { x: 30.8 * Math.cos(angle), y: 30.8 * Math.sin(angle) }
    const interior = { x: 29 * Math.cos(angle), y: 29 * Math.sin(angle) }
    expect(rects.some((rect) => containsPoint(rect, exterior))).toBe(true)
    expect(rects.some((rect) => containsPoint(rect, interior))).toBe(false)
  }
})
