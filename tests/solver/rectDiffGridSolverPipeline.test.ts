import { expect, test } from "bun:test"
import srj from "test-assets/bugreport11-b2de3c.json"
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

test("RectDiffPipeline mesh layer snapshots", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj.simple_route_json,
  })

  const outline = makeSimpleRouteOutlineGraphics(srj.simple_route_json)

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const rectsByCombo = makeCapacityMeshNodeWithLayerInfo(meshNodes)
  const allGraphicsObjects: GraphicsObject[] = []

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
