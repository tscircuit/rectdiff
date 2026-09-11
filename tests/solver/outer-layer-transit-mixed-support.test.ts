import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"

test("outer-layer promotion does not extend inner-layer access beyond its support", (): void => {
  const meshNodes: CapacityMeshNode[] = [
    {
      capacityMeshNodeId: "top",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layer: "z0",
      availableZ: [0],
    },
    ...[
      [2, 5],
      [3, 5],
    ].map((availableZ, index) => ({
      capacityMeshNodeId: `support-${index}`,
      center: { x: index === 0 ? -1 : 1, y: 0 },
      width: 2,
      height: 4,
      layer: `z${availableZ.join(",")}`,
      availableZ,
    })),
  ]
  const solver = new OuterLayerContainmentMergeSolver({
    meshNodes,
    simpleRouteJson: {
      layerCount: 6,
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
  expect(outputNodes).toHaveLength(2)
  for (const node of outputNodes) {
    expect(node.width).toBe(2)
    expect(node.height).toBe(4)
    expect(node.availableZ).toEqual(node.center.x < 0 ? [0, 2, 5] : [0, 3, 5])
  }
})
