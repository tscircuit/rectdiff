import { expect, test } from "bun:test"
import {
  getBounds,
  getSvgFromGraphicsObject,
  mergeGraphics,
  stackGraphicsVertically,
  type GraphicsObject,
  type Rect,
} from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import { containsPoint } from "lib/utils/rectdiff-geometry"
import { makeCapacityMeshNodeWithLayerInfo } from "tests/fixtures/makeCapacityMeshNodeWithLayerInfo"
import { makeSimpleRouteOutlineGraphics } from "tests/fixtures/makeSimpleRouteOutlineGraphics"
import bugReport from "./bugreport84-726193.json"

const srj = bugReport.simple_route_json

test("bugreport84-726193", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj,
    maxGapFillPasses: 4,
  })
  const outline = makeSimpleRouteOutlineGraphics(srj)

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const reportedExteriorPoint = { x: 28.5, y: -25 }
  const meshContainsReportedExteriorPoint = meshNodes.some((node) =>
    containsPoint(
      {
        x: node.center.x - node.width / 2,
        y: node.center.y - node.height / 2,
        width: node.width,
        height: node.height,
      },
      reportedExteriorPoint,
    ),
  )

  expect(meshContainsReportedExteriorPoint).toBe(false)

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

    const maxY = layerRects.reduce(
      (currentMax, rect) =>
        Math.max(currentMax, rect.center.y + rect.height * (2 / 3)),
      0,
    )
    const graphics: GraphicsObject = {
      title: `RectDiffPipeline - z${z}`,
      texts: [
        {
          anchorSide: "top_right",
          text: `Layer z=${z}`,
          x: 0,
          y: maxY,
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
