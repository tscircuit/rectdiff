import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffExpansionSolver } from "lib/solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import { createTwoNodeExpansionInput } from "lib/fixtures/twoNodeExpansionFixture"
import { makeCapacityMeshNodeWithLayerInfo } from "tests/fixtures/makeCapacityMeshNodeWithLayerInfo"

test("RectDiff expansion grows one node across empty space until it hits the other", async () => {
  const solver = new RectDiffExpansionSolver(createTwoNodeExpansionInput())

  solver.solve()

  const { meshNodes } = solver.getOutput()
  expect(meshNodes.length).toBe(2)

  const sorted = [...meshNodes].sort((a, b) => a.center.x - b.center.x)
  const [left, right] = sorted

  expect(left!.width).toBeCloseTo(9.5, 3)
  expect(left!.center.x).toBeCloseTo(4.75, 3)
  expect(right!.width).toBeCloseTo(2.5, 3)
  expect(right!.center.x).toBeCloseTo(10.75, 3)

  const finalGraphics = makeCapacityMeshNodeWithLayerInfo(meshNodes)
  const svg = getSvgFromGraphicsObject(
    { rects: finalGraphics.values().toArray().flat() },
    {
      svgWidth: 640,
      svgHeight: 480,
    },
  )

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
