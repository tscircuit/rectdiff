import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"

test("matching outer-layer candidates produce one shared routing region", (): void => {
  const meshNodes: CapacityMeshNode[] = [0, 3].map((z) => ({
    capacityMeshNodeId: `outer-${z}`,
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    layer: `z${z}`,
    availableZ: [z],
  }))
  const solver = new OuterLayerContainmentMergeSolver({
    meshNodes,
    simpleRouteJson: {
      layerCount: 4,
      bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      minTraceWidth: 0.08,
      minViaDiameter: 0.45,
      connections: [],
      obstacles: [1, 2].map((z) => ({
        type: "rect",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        layers: [`inner${z}`],
        connectedTo: [`plane-${z}`],
        isCopperPour: true,
      })),
    },
    zIndexByName: new Map([
      ["top", 0],
      ["inner1", 1],
      ["inner2", 2],
      ["bottom", 3],
    ]),
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const { outputNodes } = solver.getOutput()
  expect(outputNodes).toHaveLength(1)
  expect(outputNodes[0]!.availableZ).toEqual([0, 3])
  expect(outputNodes[0]!.width * outputNodes[0]!.height).toBe(4)
})
