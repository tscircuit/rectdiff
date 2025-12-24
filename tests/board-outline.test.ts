import { expect, test } from "bun:test"
import boardWithCutout from "../test-assets/board-with-cutout.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { getSvgFromGraphicsObject } from "graphics-debug"

test("board outline snapshot", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: boardWithCutout as any,
  })

  // Run to completion
  solver.solve()

  const viz = solver.finalVisualize()
  const svg = getSvgFromGraphicsObject(viz)

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
