import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"

test("outer-layer promotion preserves existing inner-to-bottom via access", (): void => {
  for (const supportWidth of [2, 4]) {
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
        width: supportWidth,
        height: supportWidth,
        layer: "z2,3",
        availableZ: [2, 3],
      },
    ]
    const solver = new OuterLayerContainmentMergeSolver({
      meshNodes,
      simpleRouteJson: {
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
        ],
        connections: [],
      },
      zIndexByName: new Map([["inner1", 1]]),
    })
    solver.solve()
    const { outputNodes } = solver.getOutput()
    const innerToBottomArea = outputNodes
      .filter(
        (node) => node.availableZ.includes(2) && node.availableZ.includes(3),
      )
      .reduce((area, node) => area + node.width * node.height, 0)
    expect(innerToBottomArea).toBe(supportWidth * supportWidth)
    expect(
      outputNodes.some((node) =>
        [0, 2, 3].every((z) => node.availableZ.includes(z)),
      ),
    ).toBe(true)
  }
})
