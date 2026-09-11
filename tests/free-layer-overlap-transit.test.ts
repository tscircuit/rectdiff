import { expect, test } from "bun:test"
import { refineFreeLayerOverlaps } from "lib/solvers/OuterLayerContainmentMergeSolver/refineFreeLayerOverlaps"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "lib/types/srj-types"

test("free-layer refinement preserves remainders and rejects blocked or narrow transit", () => {
  const meshNodes: CapacityMeshNode[] = [
    {
      capacityMeshNodeId: "top",
      center: { x: 1, y: 1 },
      width: 2,
      height: 2,
      layer: "top",
      availableZ: [0],
    },
    {
      capacityMeshNodeId: "lower",
      center: { x: 2, y: 1 },
      width: 2,
      height: 2,
      layer: "bottom",
      availableZ: [2, 3],
    },
  ]
  const simpleRouteJson: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 3, minY: 0, maxY: 2 },
    layerCount: 4,
    minTraceWidth: 0.15,
    minViaDiameter: 0.3,
    connections: [],
    obstacles: [
      {
        type: "rect",
        center: { x: 1.5, y: 1 },
        width: 3,
        height: 2,
        layers: ["inner1"],
        connectedTo: [],
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
  const refined = refineFreeLayerOverlaps(input)
  expect(refined).toHaveLength(3)
  expect(refined.find((node) => node.availableZ.length === 3)).toMatchObject({
    center: { x: 1.5, y: 1 },
    width: 1,
    height: 2,
    availableZ: [0, 2, 3],
  })
  expect(refined.find((node) => node.availableZ.length === 1)).toMatchObject({
    center: { x: 0.5, y: 1 },
    width: 1,
    height: 2,
    availableZ: [0],
  })
  expect(refined.find((node) => node.availableZ.length === 2)).toMatchObject({
    center: { x: 2.5, y: 1 },
    width: 1,
    height: 2,
    availableZ: [2, 3],
  })
  const solid = structuredClone(input)
  solid.simpleRouteJson.obstacles[0]!.isCopperPour = false
  expect(refineFreeLayerOverlaps(solid)).toEqual(meshNodes)
  const uncovered = structuredClone(input)
  uncovered.simpleRouteJson.obstacles[0]!.width = 0.5
  expect(refineFreeLayerOverlaps(uncovered)).toEqual(meshNodes)
  const narrow = structuredClone(input)
  narrow.meshNodes[1]!.center.x = 2.9
  expect(refineFreeLayerOverlaps(narrow)).toEqual(narrow.meshNodes)
  const touching = structuredClone(input)
  touching.meshNodes[1]!.center.x = 3
  expect(refineFreeLayerOverlaps(touching)).toEqual(touching.meshNodes)
  const target = structuredClone(input)
  target.meshNodes[0]!._containsTarget = true
  expect(refineFreeLayerOverlaps(target)).toEqual(target.meshNodes)
})
