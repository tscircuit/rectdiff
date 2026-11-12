import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "lib/types/srj-types"

test("inner-plane transit preserves partial support and rejects blocked or narrow via access", () => {
  const meshNodes: CapacityMeshNode[] = [
    {
      capacityMeshNodeId: "via",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      layer: "z0,3",
      availableZ: [0, 3],
    },
    {
      capacityMeshNodeId: "signal",
      center: { x: 0.5, y: 0 },
      width: 2,
      height: 2,
      layer: "z2",
      availableZ: [2],
    },
    {
      capacityMeshNodeId: "via-inner-transit-0",
      center: { x: 5, y: 5 },
      width: 1,
      height: 1,
      layer: "z0",
      availableZ: [0],
    },
  ]
  const simpleRouteJson: SimpleRouteJson = {
    bounds: { minX: -2, maxX: 6, minY: -2, maxY: 6 },
    layerCount: 4,
    minTraceWidth: 0.1,
    minViaDiameter: 0.45,
    connections: [],
    obstacles: [
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        layers: ["inner1"],
        connectedTo: ["GND"],
        isCopperPour: true,
      },
    ],
  }
  const input = {
    meshNodes,
    simpleRouteJson,
    zIndexByName: new Map([
      ["top", 0],
      ["inner1", 1],
      ["inner2", 2],
      ["bottom", 3],
    ]),
  }
  const original = structuredClone(input)
  const solver = new OuterLayerContainmentMergeSolver(input)
  solver.solve()
  const output = solver.getOutput().outputNodes
  const shared = output.filter((node) => node.availableZ.length === 3)
  expect(shared).toHaveLength(1)
  expect(shared[0]).toMatchObject({
    center: { x: 0.25, y: 0 },
    width: 1.5,
    height: 2,
    availableZ: [0, 2, 3],
  })
  expect(new Set(output.map((node) => node.capacityMeshNodeId)).size).toBe(
    output.length,
  )
  expect(input).toEqual(original)
  for (const z of [0, 1, 2, 3]) {
    const area = (nodes: CapacityMeshNode[]) =>
      nodes
        .filter((node) => node.availableZ.includes(z))
        .reduce((sum, node) => sum + node.width * node.height, 0)
    expect(area(output)).toBeCloseTo(area(meshNodes), 10)
    const onLayer = output.filter((node) => node.availableZ.includes(z))
    for (const [index, a] of onLayer.entries()) {
      for (const b of onLayer.slice(index + 1)) {
        const overlapWidth =
          Math.min(a.center.x + a.width / 2, b.center.x + b.width / 2) -
          Math.max(a.center.x - a.width / 2, b.center.x - b.width / 2)
        const overlapHeight =
          Math.min(a.center.y + a.height / 2, b.center.y + b.height / 2) -
          Math.max(a.center.y - a.height / 2, b.center.y - b.height / 2)
        expect(overlapWidth <= 1e-9 || overlapHeight <= 1e-9).toBe(true)
      }
    }
  }

  const blocked = structuredClone(input)
  blocked.simpleRouteJson.obstacles[0]!.isCopperPour = false
  const noPlane = structuredClone(input)
  noPlane.simpleRouteJson.obstacles = []
  const narrow = structuredClone(input)
  narrow.meshNodes[1]!.center.x = 1.9
  const target = structuredClone(input)
  target.meshNodes[1]!._containsTarget = true
  const solidInner = structuredClone(input)
  solidInner.simpleRouteJson.obstacles.push({
    type: "rect",
    center: { x: 0, y: 0 },
    width: 0.3,
    height: 0.3,
    layers: ["inner2"],
    connectedTo: ["OTHER_SIGNAL"],
  })
  for (const rejected of [blocked, noPlane, narrow, target, solidInner]) {
    const control = new OuterLayerContainmentMergeSolver(rejected)
    control.solve()
    expect(control.getOutput().outputNodes).toEqual(rejected.meshNodes)
  }
})
