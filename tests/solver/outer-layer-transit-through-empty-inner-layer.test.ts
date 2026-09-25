import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { OuterLayerContainmentMergeSolver } from "lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { Obstacle, SimpleRouteJson } from "lib/types/srj-types"

test("outer layers connect through a copper plane and an empty inner layer without overlapping support nodes", async (): Promise<void> => {
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
      capacityMeshNodeId: "bottom-support",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layer: "z2,3",
      availableZ: [2, 3],
    },
  ]
  const obstacles: Obstacle[] = [
    {
      type: "rect",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layers: ["inner1"],
      connectedTo: ["ground"],
      isCopperPour: true,
    },
  ]
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 4,
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
    minTraceWidth: 0.08,
    minViaDiameter: 0.45,
    obstacles,
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
  const outputNodes = solver.getOutput().outputNodes
  expect(
    outputNodes.find((node) => node.capacityMeshNodeId === "top")?.availableZ,
  ).toEqual([0, 2, 3])
  for (const [z, expectedArea] of [4, 0, 16, 16].entries()) {
    const nodesOnLayer = outputNodes.filter((node) =>
      node.availableZ.includes(z),
    )
    const area = nodesOnLayer.reduce(
      (sum, node) => sum + node.width * node.height,
      0,
    )
    expect(area).toBe(expectedArea)
    for (let i = 0; i < nodesOnLayer.length; i++) {
      for (const other of nodesOnLayer.slice(i + 1)) {
        const node = nodesOnLayer[i]!
        const overlapWidth =
          (node.width + other.width) / 2 -
          Math.abs(node.center.x - other.center.x)
        const overlapHeight =
          (node.height + other.height) / 2 -
          Math.abs(node.center.y - other.center.y)
        expect(overlapWidth <= 0 || overlapHeight <= 0).toBe(true)
      }
    }
  }
  expect(meshNodes[0]!.availableZ).toEqual([0])
  expect(meshNodes[1]!.availableZ).toEqual([2, 3])
  const svg = getSvgFromGraphicsObject(solver.visualize(), {
    backgroundColor: "white",
  })
  await expect(svg.replace(/[ \t]+$/gm, "")).toMatchSvgSnapshot(
    import.meta.path,
  )
})
