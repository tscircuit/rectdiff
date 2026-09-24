import type { GraphicsObject } from "graphics-debug"
import { OuterLayerContainmentMergeSolver } from "../../../lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "../../../lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"

export const node = (
  id: string,
  z: number,
  x = 0,
  width = 4,
): CapacityMeshNode => ({
  capacityMeshNodeId: id,
  center: { x: x + width / 2, y: 2 },
  width,
  height: 4,
  availableZ: [z],
  layer: `z${z}`,
})

export const inputNodes = [node("top", 0), node("bottom", 3)]

export function solve(meshNodes = inputNodes) {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 4,
    minTraceWidth: 0.1,
    minViaDiameter: 0.3,
    bounds: { minX: 0, maxX: 8, minY: 0, maxY: 4 },
    connections: [],
    obstacles: [
      {
        type: "rect",
        center: { x: 4, y: 2 },
        width: 8,
        height: 4,
        layers: ["inner1", "inner2"],
        isCopperPour: true,
        connectedTo: [],
      },
    ],
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
  if (!solver.solved) throw new Error("Merge solver did not finish")
  return solver.getOutput().outputNodes
}

export function comparisonGraphics(output: CapacityMeshNode[]): GraphicsObject {
  const graphics: GraphicsObject = {
    coordinateSystem: "cartesian",
    rects: [],
    texts: [],
    lines: [],
  }
  for (const [column, nodes] of [inputNodes, output].entries()) {
    for (const [row, z] of [0, 3].entries()) {
      const x = column * 7
      const y = -row * 7
      const onLayer = nodes.filter((n) => n.availableZ.includes(z))
      const area = onLayer.reduce((sum, n) => sum + n.width * n.height, 0)
      graphics.texts!.push(
        {
          text: `${column === 0 ? "INPUT" : "OUTPUT"} / ${z === 0 ? "TOP" : "BOTTOM"}`,
          x: x + 2,
          y: y + 5,
          fontSize: 0.3,
        },
        {
          text: `${onLayer.length} node(s); summed area = ${area}`,
          x: x + 2,
          y: y - 0.5,
          fontSize: 0.25,
        },
        {
          text: `IDs: ${onLayer.map((n) => n.capacityMeshNodeId).join(" + ")}`,
          x: x + 2,
          y: y - 1,
          fontSize: 0.25,
        },
      )
      for (const n of onLayer) {
        graphics.rects!.push({
          center: { x: x + n.center.x, y: y + n.center.y },
          width: n.width,
          height: n.height,
          fill:
            n.capacityMeshNodeId === "top"
              ? "rgba(59,130,246,0.35)"
              : "rgba(239,68,68,0.35)",
          stroke: n.capacityMeshNodeId === "top" ? "#2563eb" : "#dc2626",
        })
      }
    }
  }
  return graphics
}
