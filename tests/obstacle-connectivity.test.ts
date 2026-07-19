import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "../lib/types/srj-types"

const getObstacleNodesAt = (
  nodes: CapacityMeshNode[],
  x: number,
  y: number,
): CapacityMeshNode[] =>
  nodes.filter(
    (node) =>
      node._containsObstacle && node.center.x === x && node.center.y === y,
  )

test("preserves obstacle connectivity without merging different nets across layers", () => {
  const srj: SimpleRouteJson = {
    bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    connections: [],
    minTraceWidth: 0.2,
    layerCount: 2,
    obstacles: [
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        layers: ["top"],
        connectedTo: ["net-top"],
      },
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        layers: ["bottom"],
        connectedTo: ["net-bottom"],
      },
      {
        type: "rect",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        layers: ["top", "bottom"],
        connectedTo: ["pad-shared", "net-shared", "net-shared"],
      },
    ],
  }
  const pipeline = new RectDiffPipeline({
    simpleRouteJson: srj,
    maxGapFillPasses: 1,
  })

  pipeline.solve()

  const meshNodes = pipeline.getOutput().meshNodes
  const layerSpecificNodes = getObstacleNodesAt(meshNodes, 0, 0)
    .map((node) => ({
      availableZ: node.availableZ,
      connectedTo: node._connectedTo,
    }))
    .sort((a, b) => a.availableZ[0]! - b.availableZ[0]!)

  expect(layerSpecificNodes).toEqual([
    { availableZ: [0], connectedTo: ["net-top"] },
    { availableZ: [1], connectedTo: ["net-bottom"] },
  ])

  const sharedNode = getObstacleNodesAt(meshNodes, 2, 0)
  expect(sharedNode).toHaveLength(1)
  expect(sharedNode[0]?.availableZ).toEqual([0, 1])
  expect(sharedNode[0]?._connectedTo).toEqual(["net-shared", "pad-shared"])
})
