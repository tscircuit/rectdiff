import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import simpleRouteJson from "./bugreport37-srj18-sample002.json"
test("bugreport37-srj18-sample002", async () => {
  const solver = new RectDiffPipeline({ simpleRouteJson, maxGapFillPasses: 4 })
  solver.solve()
  await expect(getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" })).toMatchSvgSnapshot(import.meta.path)
})
