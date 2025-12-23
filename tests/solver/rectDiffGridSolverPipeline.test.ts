import { expect, test } from "bun:test"
import srj from "test-assets/bugreport11-b2de3c.json"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import { getPerLayerVisualizations } from "tests/fixtures/getPerLayerVisualizations"
import { applyZLayerColors } from "tests/fixtures/applyZLayerColors"

test("RectDiffPipeline outline snapshot", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj.simple_route_json,
  })

  solver.solve()

  const viz = solver.visualize()!

  const map = getPerLayerVisualizations(viz)

  for (const key of map.keys()) {
    const perLayerViz = map.get(key)!
    const coloredViz = applyZLayerColors(perLayerViz)
    const svg = getSvgFromGraphicsObject(coloredViz)
    await expect(svg).toMatchSvgSnapshot(`${import.meta.path}-${key}`)
  }
})
