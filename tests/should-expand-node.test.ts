import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffExpansionSolver } from "lib/solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import { createTwoNodeExpansionInput } from "lib/fixtures/twoNodeExpansionFixture"
import { makeCapacityMeshNodeWithLayerInfo } from "./fixtures/makeCapacityMeshNodeWithLayerInfo"

test("RectDiff expansion reproduces the two-node gap fixture", async () => {
  const solver = new RectDiffExpansionSolver(createTwoNodeExpansionInput())

  solver.solve()

  const { meshNodes } = solver.getOutput()
  expect(meshNodes.length).toBeGreaterThanOrEqual(2)

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
