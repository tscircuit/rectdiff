import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "lib/types/srj-types"

const makeNode = (
  capacityMeshNodeId: string,
  centerX: number,
  width: number,
  height: number,
  availableZ: number[],
): CapacityMeshNode => ({
  capacityMeshNodeId,
  center: { x: centerX, y: 0 },
  width,
  height,
  layer: `z${availableZ.join(",")}`,
  availableZ,
})

test("OuterLayerContainmentMergeSolver only promotes nodes larger than 1 mm^2", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: -1,
      maxX: 6,
      minY: -1,
      maxY: 1,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["inner1"],
        zLayers: [1],
        center: { x: 2.5, y: 0 },
        width: 7,
        height: 2,
        connectedTo: [],
        isCopperPour: true,
      },
    ],
    connections: [],
    layerCount: 3,
    minTraceWidth: 0.1,
  }

  const solver = new OuterLayerContainmentMergeSolver({
    meshNodes: [
      makeNode("below-threshold", 0.4, 0.8, 1, [0]),
      makeNode("at-threshold", 2, 1, 1, [0]),
      makeNode("above-threshold", 4.6, 1.2, 1, [0]),
      makeNode("below-support", 0.4, 0.8, 1, [1, 2]),
      makeNode("at-support", 2, 1, 1, [1, 2]),
      makeNode("above-support", 4.6, 1.2, 1, [1, 2]),
    ],
    simpleRouteJson,
    zIndexByName: new Map([
      ["top", 0],
      ["inner1", 1],
      ["bottom", 2],
    ]),
  })

  solver.solve()

  const outputNodes = solver.getOutput().outputNodes
  const nodeById = new Map(
    outputNodes.map((node) => [node.capacityMeshNodeId, node] as const),
  )

  expect(nodeById.get("below-threshold")?.availableZ).toEqual([0])
  expect(nodeById.get("at-threshold")?.availableZ).toEqual([0])
  expect(nodeById.get("above-threshold")?.availableZ).toEqual([0, 2])
})
