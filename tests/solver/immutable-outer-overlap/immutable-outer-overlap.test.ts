import { expect, test } from "bun:test"
import { OuterLayerContainmentMergeSolver } from "../../../lib/solvers/OuterLayerContainmentMergeSolver/OuterLayerContainmentMergeSolver"
import type { CapacityMeshNode } from "../../../lib/types/capacity-mesh-types"
import { overlaps } from "../../../lib/utils/rectdiff-geometry"

const node = ({
  capacityMeshNodeId,
  availableZ,
  minX = 0,
  width = 4,
}: {
  capacityMeshNodeId: string
  availableZ: number[]
  minX?: number
  width?: number
}): CapacityMeshNode => ({
  capacityMeshNodeId,
  center: { x: minX + width / 2, y: 2 },
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
const area = (nodes: CapacityMeshNode[], zs: number[]) =>
  nodes
    .filter((n) => zs.every((z) => n.availableZ.includes(z)))
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
      bounds: { minX: -1, maxX: 8, minY: 0, maxY: 4 },
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

function expectPreservedMesh(
  input: CapacityMeshNode[],
  output: CapacityMeshNode[],
) {
  expect(conflicts(input)).toHaveLength(0)
  expect(conflicts(output)).toHaveLength(0)
  for (let z = 0; z < 4; z++) {
    expect(area(output, [z])).toBe(area(input, [z]))
    for (let other = z + 1; other < 4; other++) {
      expect(area(output, [z, other])).toBeGreaterThanOrEqual(
        area(input, [z, other]),
      )
    }
  }
}

function diagram(input: CapacityMeshNode[], output: CapacityMeshNode[]) {
  const panels = [input, output]
    .flatMap((nodes, col) =>
      [0, 1, 2, 3].map((z, row) => {
        const active = nodes.filter((n) => n.availableZ.includes(z))
        const ox = 40 + col * 480
        const oy = 130 + row * 160
        const shapes = active
          .map(
            (n) =>
              `<rect x="${ox}" y="${oy + 20}" width="120" height="120" fill="#22c55e33" stroke="#15803d" stroke-width="3"/>`,
          )
          .join("")
        return `<g><text x="${ox}" y="${oy}" font-size="20" font-weight="bold">${col ? "Output" : "Input"} / z=${z}</text>${shapes}${active.map((n, i) => `<text x="${ox + 145}" y="${oy + 55 + i * 25}" font-size="16">${n.capacityMeshNodeId} [${n.availableZ}]</text>`).join("")}<text x="${ox + 145}" y="${oy + 115}" font-size="16">layer area: ${area(nodes, [z])}</text></g>`
      }),
    )
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="820" viewBox="0 0 1000 820"><rect width="1000" height="820" fill="white"/><g font-family="Arial, sans-serif" fill="#172033"><text x="40" y="40" font-size="25" font-weight="bold">Free multilayer support is merged safely</text><text x="40" y="75" font-size="17">The promoted candidate inherits [1,3]; consumed support is removed.</text>${panels}<text x="40" y="795" font-size="17">Same-layer overlapping pairs: input ${conflicts(input).length}; output ${conflicts(output).length}.</text></g></svg>`
}

test("merges free multilayer support without overlap or losing transit", async () => {
  const input = [
    node({ capacityMeshNodeId: "candidate", availableZ: [0] }),
    node({ capacityMeshNodeId: "support", availableZ: [1, 3] }),
  ]
  const output = solve(input)
  expectPreservedMesh(input, output)
  expect(output).toHaveLength(1)
  expect(output[0]!.availableZ).toEqual([0, 1, 3])
  expect(area(output, [0, 3])).toBe(16)
  await expect(diagram(input, output)).toMatchSvgSnapshot(import.meta.path)
})

test("preserves transit when bottom promotes into free top support", () => {
  const input = [
    node({ capacityMeshNodeId: "candidate", availableZ: [3] }),
    node({ capacityMeshNodeId: "support", availableZ: [0, 2] }),
  ]
  const output = solve(input)
  expectPreservedMesh(input, output)
  expect(output).toHaveLength(1)
  expect(output[0]!.availableZ).toEqual([0, 2, 3])
})

test("splits mixed support while preserving every layer and transition", () => {
  const input = [
    node({ capacityMeshNodeId: "candidate", availableZ: [0] }),
    node({
      capacityMeshNodeId: "support",
      availableZ: [1, 3],
      minX: 0,
      width: 2,
    }),
    node({ capacityMeshNodeId: "bottom", availableZ: [3], minX: 2, width: 2 }),
  ]
  const output = solve(input)
  expectPreservedMesh(input, output)
  expect(area(output, [0, 3])).toBe(16)
  expect(area(output, [0, 1, 3])).toBe(8)
  expect(output).toHaveLength(2)
})

test("carves larger support and preserves adjacent multilayer support", () => {
  const input = [
    node({ capacityMeshNodeId: "candidate", availableZ: [0] }),
    node({ capacityMeshNodeId: "bottom", availableZ: [3], minX: -1, width: 6 }),
    node({
      capacityMeshNodeId: "support",
      availableZ: [1, 3],
      minX: 5,
      width: 1,
    }),
  ]
  const output = solve(input)
  expectPreservedMesh(input, output)
  expect(
    output.find((n) => n.capacityMeshNodeId === "candidate")!.availableZ,
  ).toEqual([0, 3])
  expect(output.find((n) => n.capacityMeshNodeId === "support")).toEqual(
    input[2],
  )
})

for (const flag of ["_containsObstacle", "_containsTarget"] as const) {
  test(`${flag} is preserved and cannot count as free opposite support`, () => {
    const immutable = {
      ...node({ capacityMeshNodeId: "immutable", availableZ: [1, 3] }),
      [flag]: true,
    }
    const input = [
      node({ capacityMeshNodeId: "candidate", availableZ: [0] }),
      immutable,
    ]
    const output = solve(input)
    expectPreservedMesh(input, output)
    expect(output).toEqual(input)
  })

  test(`adjacent ${flag} does not block free support promotion`, () => {
    const immutable = {
      ...node({
        capacityMeshNodeId: "immutable",
        availableZ: [1, 3],
        minX: 4,
        width: 2,
      }),
      [flag]: true,
    }
    const input = [
      node({ capacityMeshNodeId: "candidate", availableZ: [0] }),
      node({ capacityMeshNodeId: "support", availableZ: [1, 3] }),
      immutable,
    ]
    const output = solve(input)
    expectPreservedMesh(input, output)
    expect(area(output, [0, 1, 3])).toBe(16)
    expect(output.find((n) => n.capacityMeshNodeId === "immutable")).toEqual(
      immutable,
    )
  })
}
