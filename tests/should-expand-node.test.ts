import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject, mergeGraphics } from "graphics-debug"
import { RectDiffExpansionSolver } from "lib/solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import { createTwoNodeExpansionInput } from "lib/fixtures/twoNodeExpansionFixture"
import { makeCapacityMeshNodeWithLayerInfo } from "./fixtures/makeCapacityMeshNodeWithLayerInfo"
import { makeSimpleRouteOutlineGraphics } from "./fixtures/makeSimpleRouteOutlineGraphics"

test("RectDiff expansion reproduces the two-node gap fixture", async () => {
  const input = createTwoNodeExpansionInput()
  const solver = new RectDiffExpansionSolver(input)

  solver.solve()

  const { meshNodes } = solver.getOutput()
  expect(meshNodes.length).toBeGreaterThanOrEqual(2)

  const finalGraphics = makeCapacityMeshNodeWithLayerInfo(meshNodes)
  const outline = makeSimpleRouteOutlineGraphics({
    bounds: {
      minX: input.bounds.x,
      maxX: input.bounds.x + input.bounds.width,
      minY: input.bounds.y,
      maxY: input.bounds.y + input.bounds.height,
    },
    outline: undefined,
  })
  const svg = getSvgFromGraphicsObject(
    mergeGraphics({ rects: finalGraphics.values().toArray().flat() }, outline),
    {
      svgWidth: 640,
      svgHeight: 480,
    },
  )

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
