import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "lib/types/srj-types"

test("outer-layer promotion preserves solid inner obstacles", () => {
  const meshNodes: CapacityMeshNode[] = [
    {
      capacityMeshNodeId: "top",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      layer: "z0",
      availableZ: [0],
    },
    {
      capacityMeshNodeId: "bottom",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      layer: "z3",
      availableZ: [3],
    },
  ]
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 4,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
    minTraceWidth: 0.08,
    minViaDiameter: 0.45,
    obstacles: [
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        layers: ["inner1"],
        connectedTo: ["ground"],
        isCopperPour: true,
      },
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 0.5,
        height: 0.5,
        layers: ["inner2"],
        connectedTo: ["signal"],
      },
    ],
    connections: [],
  }
  const solver = new OuterLayerContainmentMergeSolver({
    meshNodes,
    simpleRouteJson,
    zIndexByName: new Map([
      ["top", 0],
      ["inner1", 1],
      ["inner2", 2],
      ["bottom", 3],
    ]),
  })
  solver.solve()
  expect(solver.getOutput().outputNodes).toEqual(meshNodes)
})
