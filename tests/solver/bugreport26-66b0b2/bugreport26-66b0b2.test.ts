import { expect, test } from "bun:test"
import srj_json from "./bugreport26-66b0b2.json"
import {
  getBounds,
  getSvgFromGraphicsObject,
  mergeGraphics,
  stackGraphicsVertically,
  type GraphicsObject,
  type Rect,
} from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import { makeCapacityMeshNodeWithLayerInfo } from "tests/fixtures/makeCapacityMeshNodeWithLayerInfo"
import { makeSimpleRouteOutlineGraphics } from "tests/fixtures/makeSimpleRouteOutlineGraphics"

const srj = srj_json.simple_route_json ?? srj_json.simpleRouteJson ?? srj_json

test("bugreport26-66b0b2", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj,
  })

  const outline = makeSimpleRouteOutlineGraphics(srj)

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const rectsByCombo = makeCapacityMeshNodeWithLayerInfo(meshNodes)
  const allGraphicsObjects: GraphicsObject[] = []

  for (const z of Array.from({ length: srj.layerCount }, (_, index) => index)) {
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

    let labelY = 0

    if (layerRects.length > 0) {
      let maxY = -Infinity

      for (const rect of layerRects) {
        const top = rect.center.y + rect.height * (2 / 3)

        if (top > maxY) maxY = top
      }

      labelY = maxY
    }

    const graphics: GraphicsObject = {
      title: `RectDiffPipeline - z${z}`,
      texts: [
        {
          anchorSide: "top_right",
          text: `Layer z=${z}`,
          x: 0,
          y: labelY,
          fontSize: 0.5,
        },
      ],
      coordinateSystem: "cartesian",
      rects: layerRects,
      points: [],
      lines: [],
    }

    allGraphicsObjects.push(mergeGraphics(graphics, outline))
  }

  const stackedGraphics = stackGraphicsVertically(allGraphicsObjects)
  const bounds = getBounds(stackedGraphics)
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY)
  const svgWidth = 640
  const svgHeight = Math.max(
    svgWidth,
    Math.ceil((boundsHeight / boundsWidth) * svgWidth),
  )

  const svg = getSvgFromGraphicsObject(stackedGraphics, {
    svgWidth,
    svgHeight,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
