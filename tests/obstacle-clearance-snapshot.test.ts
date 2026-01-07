import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { makeCapacityMeshNodeWithLayerInfo } from "./fixtures/makeCapacityMeshNodeWithLayerInfo"

const simpleRouteJson: SimpleRouteJson = {
  bounds: {
    minX: 0,
    maxX: 10,
    minY: 0,
    maxY: 10,
  },
  obstacles: [
    {
      type: "rect",
      layers: ["top"],
      center: { x: 5, y: 5 },
      width: 2,
      height: 2,
      connectedTo: [],
    },
  ],
  connections: [],
  layerCount: 2,
  minTraceWidth: 0.15,
}

test("RectDiffPipeline obstacle clearance snapshot", async () => {
  const pipeline = new RectDiffPipeline({
    simpleRouteJson,
    obstacleClearance: 1,
  })

  pipeline.solve()

  const meshNodesGraphics = makeCapacityMeshNodeWithLayerInfo(
    pipeline.getOutput().meshNodes,
  )
    .values()
    .toArray()
    .flat()

  const svg = getSvgFromGraphicsObject({
    rects: meshNodesGraphics,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
