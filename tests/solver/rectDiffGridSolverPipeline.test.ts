import { expect, test } from "bun:test"
import srj from "test-assets/bugreport11-b2de3c.json"
import {
  getSvgFromGraphicsObject,
  type GraphicsObject,
  type Rect,
} from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import { makeCapacityMeshNodeWithLayerInfo } from "tests/fixtures/makeCapqcityNode"

test("RectDiffPipeline mesh layer snapshots", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj.simple_route_json,
  })

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const rectsByCombo = makeCapacityMeshNodeWithLayerInfo(meshNodes)

  // Generate a snapshot for each z-layer
  for (const z of [0, 1, 2, 3]) {
    const layerRects: Rect[] = []

    for (const [key, rects] of rectsByCombo) {
      const layers = key
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => !Number.isNaN(value))

      if (layers.includes(z)) {
        layerRects.push(...rects)
      }
    }

    const graphics: GraphicsObject = {
      title: `RectDiffPipeline - z${z}`,
      coordinateSystem: "cartesian",
      rects: layerRects,
      points: [],
      lines: [],
    }

    const svg = getSvgFromGraphicsObject(graphics)
    await expect(svg).toMatchSvgSnapshot(`${import.meta.path}-z${z}`)
  }
})
