import { expect, test } from "bun:test"
import srj_json from "./bugreport50-multi-support-layer-merge.json"
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

const wrapped = Array.isArray(srj_json) ? srj_json[0] : srj_json
const srj = wrapped.simple_route_json ?? wrapped.simpleRouteJson ?? wrapped

const getFreeNodeCounts = (
  meshNodes: ReturnType<RectDiffPipeline["getOutput"]>["meshNodes"],
) => {
  const counts = new Map<string, number>()

  for (const node of meshNodes) {
    if (node._containsObstacle || node._containsTarget) continue

    const key = node.availableZ.join(",")
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

test("bugreport50-multi-support-layer-merge promotes adjacent-layer nodes supported by multiple peers", () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: srj,
  })

  solver.solve()

  const counts = getFreeNodeCounts(solver.getOutput().meshNodes)
  const z0 = counts.get("0") ?? 0
  const z01 = counts.get("0,1") ?? 0

  expect(z01).toBeGreaterThan(40)
  expect(z01).toBeGreaterThan(z0)
  expect(z0).toBeLessThan(10)
})

test("bugreport50-multi-support-layer-merge", async () => {
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
