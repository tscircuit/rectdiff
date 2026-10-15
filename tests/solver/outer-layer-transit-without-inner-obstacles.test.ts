import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"

test("outer layers connect through empty inner layers", (): void => {
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
      width: 4,
      height: 4,
      layer: "z3",
      availableZ: [3],
    },
  ]
  const solver = new OuterLayerContainmentMergeSolver({
    meshNodes,
    simpleRouteJson: {
      layerCount: 4,
      bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
      minTraceWidth: 0.08,
      minViaDiameter: 0.45,
      obstacles: [],
      connections: [],
    },
    zIndexByName: new Map([
      ["top", 0],
      ["inner1", 1],
      ["inner2", 2],
      ["bottom", 3],
    ]),
  })

  solver.solve()

  expect(
    solver
      .getOutput()
      .outputNodes.find((node) => node.capacityMeshNodeId === "top")
      ?.availableZ,
  ).toEqual([0, 3])
  expect(meshNodes.map((node) => node.availableZ)).toEqual([[0], [3]])
})
