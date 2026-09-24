import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "../../../lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "../../../lib/types/capacity-mesh-types"
import { overlaps } from "../../../lib/utils/rectdiff-geometry"

const node = (
  id: string,
  availableZ: number[],
  x = 0,
  width = 4,
): CapacityMeshNode => ({
  capacityMeshNodeId: id,
  center: { x: x + width / 2, y: 2 },
  width,
  height: 4,
  availableZ,
  layer: `z${availableZ.join(",")}`,
})
const rect = (n: CapacityMeshNode) => ({
  x: n.center.x - n.width / 2,
  y: n.center.y - n.height / 2,
  width: n.width,
  height: n.height,
})
const area = (nodes: CapacityMeshNode[], z: number) =>
  nodes
    .filter((n) => n.availableZ.includes(z))
    .reduce((sum, n) => sum + n.width * n.height, 0)
const conflicts = (nodes: CapacityMeshNode[]) =>
  nodes.flatMap((a, i) =>
    nodes
      .slice(i + 1)
      .filter(
        (b) =>
          a.availableZ.some((z) => b.availableZ.includes(z)) &&
          overlaps(rect(a), rect(b)),
      ),
  )
function solve(meshNodes: CapacityMeshNode[]) {
  const solver = new OuterLayerContainmentMergeSolver({
    meshNodes,
    simpleRouteJson: {
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
  return solver.getOutput().outputNodes
}

// Four explicit layer panels avoid hiding the bug behind coincident outlines.
function diagram(input: CapacityMeshNode[], output: CapacityMeshNode[]) {
  const panels = [input, output]
    .flatMap((nodes, col) =>
      [0, 3].map((z, row) => {
        const active = nodes.filter((n) => n.availableZ.includes(z))
        const ox = 40 + col * 480,
          oy = 130 + row * 270
        const shapes = active
          .map((n) => {
            const isCandidate = n.capacityMeshNodeId === "candidate"
            return `<rect x="${ox + 25}" y="${oy + 40}" width="180" height="180" fill="${isCandidate ? "#22c55e33" : "#a855f733"}" stroke="${isCandidate ? "#15803d" : "#7e22ce"}" stroke-width="${isCandidate ? 3 : 7}" ${isCandidate ? 'stroke-dasharray="10 7"' : ""}/>`
          })
          .join("")
        return `<g><text x="${ox}" y="${oy}" font-size="20" font-weight="bold">${col ? "Output" : "Input"} / ${z === 0 ? "top (z=0)" : "bottom (z=3)"}</text>${shapes}${active.map((n, i) => `<text x="${ox + 225}" y="${oy + 65 + i * 30}" font-size="16">${n.capacityMeshNodeId} [${n.availableZ}]</text>`).join("")}<text x="${ox + 225}" y="${oy + 150}" font-size="16">node area sum: ${area(nodes, z)}</text><text x="${ox + 225}" y="${oy + 177}" font-size="16">union area: 16</text></g>`
      }),
    )
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="740" viewBox="0 0 1000 740"><rect width="1000" height="740" fill="white"/><g font-family="Arial, sans-serif" fill="#172033"><text x="40" y="40" font-size="25" font-weight="bold">Immutable outer-layer support overlap</text><text x="40" y="75" font-size="17">4 x 4 footprint; inner copper on z=1,2 makes promotion eligible.</text>${panels}<text x="40" y="675" font-size="17">Green dashed: candidate. Purple solid: unchanged multilayer support.</text><text x="40" y="705" font-size="17">Same-layer overlapping pairs: input ${conflicts(input).length}; output ${conflicts(output).length}.</text></g></svg>`
}

test("reproduces promotion overlapping unchanged multilayer support", async () => {
  const input = [node("candidate", [0]), node("support", [1, 3])]
  const output = solve(input)
  expect(conflicts(input)).toHaveLength(0)
  expect(output.find((n) => n.capacityMeshNodeId === "support")).toEqual(
    input[1],
  )
  expect(
    output.find((n) => n.capacityMeshNodeId === "candidate")!.availableZ,
  ).toEqual([0, 3])
  expect(conflicts(output)).toHaveLength(1)
  expect(area(input, 3)).toBe(16)
  expect(area(output, 3)).toBe(32)
  await expect(diagram(input, output)).toMatchSvgSnapshot(import.meta.path)
})
