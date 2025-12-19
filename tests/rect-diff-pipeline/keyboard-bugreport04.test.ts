import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../../lib/RectDiffPipeline"
import simpleRouteJson from "../../test-assets/bugreport04-aa1d41.json"
import { getSvgFromGraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../../lib/types/srj-types"

test("RectDiffPipeline: Keyboard Bug Report 04", () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: simpleRouteJson.simple_route_json as SimpleRouteJson,
  })

  solver.solve()

  expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
