import { expect, test } from "bun:test"
import bugreport49 from "../../../test-assets/bugreport49-634662.json"
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

const srj = bugreport49.simple_route_json ?? bugreport49

test("bugreport49-634662 promotes contained outer-layer free nodes through copper pours", () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj,
  })

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const nodeArea = (node: (typeof meshNodes)[number]) => node.width * node.height
  const bridgedNodes = meshNodes.filter(
    (node) =>
      node.availableZ.join(",") === "0,3" &&
      !node._containsObstacle &&
      !node._containsTarget,
  )
  const remainingTopOnlyFreeNodes = meshNodes.filter(
    (node) =>
      node.availableZ.join(",") === "0" &&
      !node._containsObstacle &&
      !node._containsTarget,
  )
  const obstacleNodesOnBottom = meshNodes.filter(
    (node) => node._containsObstacle && node.availableZ.includes(3),
  )
  const maxRemainingTopOnlyArea = Math.max(
    0,
    ...remainingTopOnlyFreeNodes.map(nodeArea),
  )
  const minBridgedArea = Math.min(...bridgedNodes.map(nodeArea))

  expect(bridgedNodes.length).toBeGreaterThan(0)
  expect(minBridgedArea).toBeGreaterThan(1)
  expect(maxRemainingTopOnlyArea).toBeLessThanOrEqual(1)
  expect(obstacleNodesOnBottom.length).toBe(0)
})

test("bugreport49-634662", async () => {
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
