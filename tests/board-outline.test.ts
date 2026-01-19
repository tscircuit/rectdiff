import { expect, test } from "bun:test"
import boardWithCutout from "../test-assets/board-with-cutout.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { makeCapacityMeshNodeWithLayerInfo } from "./fixtures/makeCapacityMeshNodeWithLayerInfo"

test("board outline snapshot", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: boardWithCutout,
  })

  // Run to completion
  solver.solve()

  const meshNodesGraphics = makeCapacityMeshNodeWithLayerInfo(
    solver?.getOutput().meshNodes || [],
  )
    .values()
    .toArray()
    .flat()
  const svg = getSvgFromGraphicsObject({
    rects: meshNodesGraphics,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
