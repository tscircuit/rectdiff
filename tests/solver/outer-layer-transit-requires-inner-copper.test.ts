import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"

test("outer-layer containment leaves meshes without inner copper unchanged", (): void => {
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
      capacityMeshNodeId: "support",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layer: "z2,3",
      availableZ: [2, 3],
    },
  ]
  for (const copperLayer of [null, "top"]) {
    const solver = new OuterLayerContainmentMergeSolver({
      meshNodes,
      simpleRouteJson: {
        layerCount: 4,
        bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
        minTraceWidth: 0.08,
        minViaDiameter: 0.45,
        obstacles:
          copperLayer === null
            ? []
            : [
                {
                  type: "rect",
                  center: { x: 0, y: 0 },
                  width: 4,
                  height: 4,
                  layers: [copperLayer],
                  connectedTo: ["ground"],
                  isCopperPour: true,
                },
              ],
        connections: [],
      },
      zIndexByName: new Map([["top", 0]]),
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.getOutput().outputNodes).toEqual(meshNodes)
  }
})
