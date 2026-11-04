import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffPipeline } from "../lib/index"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "../lib/types/srj-types"

const bounds = { minX: -3, maxX: 7, minY: 2, maxY: 8 }
const outline = [
  { x: bounds.minX, y: bounds.minY },
  { x: bounds.maxX, y: bounds.minY },
  { x: bounds.maxX, y: bounds.maxY },
  { x: bounds.minX, y: bounds.maxY },
]

function makeBoard(): SimpleRouteJson {
  return {
    bounds,
    layerCount: 3,
    minTraceWidth: 0.1,
    minBoardEdgeClearance: 0.2,
    obstacles: [],
    connections: [],
  }
}

function solve(simpleRouteJson: SimpleRouteJson, maxGapFillPasses = 1) {
  const solver = new RectDiffPipeline({ simpleRouteJson, maxGapFillPasses })
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  return solver
}

function expectFreeSpaceWithinClearance(nodes: CapacityMeshNode[]) {
  const free = nodes.filter((node) => !node._containsObstacle)
  expect(free.length).toBeGreaterThan(0)
  for (const node of free) {
    expect(node.center.x - node.width / 2).toBeGreaterThanOrEqual(-2.8 - 1e-7)
    expect(node.center.x + node.width / 2).toBeLessThanOrEqual(6.8 + 1e-7)
    expect(node.center.y - node.height / 2).toBeGreaterThanOrEqual(2.2 - 1e-7)
    expect(node.center.y + node.height / 2).toBeLessThanOrEqual(7.8 + 1e-7)
  }
  for (const z of [0, 1, 2]) {
    expect(
      free.some(
        (node) =>
          node.availableZ.includes(z) &&
          Math.abs(node.center.x - 2) <= node.width / 2 &&
          Math.abs(node.center.y - 5) <= node.height / 2,
      ),
    ).toBe(true)
  }
}

test.each([1, 3])(
  "bounds-only clearance matches a rectangular outline with up to %i gap-fill passes",
  (passes) => {
    const board = makeBoard()
    const original = structuredClone(board)
    const solver = solve(board, passes)
    const explicitBoard = { ...makeBoard(), outline }
    const explicit = solve(explicitBoard, passes)

    for (const pipeline of [solver, explicit]) {
      expectFreeSpaceWithinClearance(
        pipeline.rectDiffGridSolverPipeline!.getOutput().meshNodes,
      )
      expectFreeSpaceWithinClearance(pipeline.getOutput().meshNodes)
    }
    expect(solver.boardVoidRects).toEqual(explicit.boardVoidRects)
    expect(board).toEqual(original)
    expect(board.bounds).toBe(bounds)
    expect(board.outline).toBeUndefined()
    expect(explicitBoard.outline).toBe(outline)
    expect(outline).toEqual([
      { x: -3, y: 2 },
      { x: 7, y: 2 },
      { x: 7, y: 8 },
      { x: -3, y: 8 },
    ])
  },
)

test.each([
  ["omitted", undefined],
  ["zero", 0],
  ["negative", -0.2],
] as const)(
  "preserves bounds-only free space for clearance %s",
  (_, minBoardEdgeClearance) => {
    const solver = solve({ ...makeBoard(), minBoardEdgeClearance })
    expect(solver.boardVoidRects).toBeUndefined()
    const nodes = solver.getOutput().meshNodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      center: { x: 2, y: 5 },
      width: 10,
      height: 6,
      availableZ: [0, 1, 2],
    })
  },
)

test("keeps near-edge obstacles while grid and gap-fill free space respects clearance", async () => {
  const board = makeBoard()
  board.obstacles = [
    {
      type: "rect",
      layers: ["top"],
      center: { x: -2.7, y: 5 },
      width: 0.4,
      height: 1,
      connectedTo: [],
    },
  ]
  const solver = solve(board, 3)
  expectFreeSpaceWithinClearance(
    solver.rectDiffGridSolverPipeline!.getOutput().meshNodes,
  )
  const nodes = solver.getOutput().meshNodes
  expectFreeSpaceWithinClearance(nodes)
  expect(
    nodes.some(
      (node) => node._containsObstacle && node.center.x - node.width / 2 < -2.8,
    ),
  ).toBe(true)
  expect(solver.gapFillSolver!.passExpandedCounts.length).toBeGreaterThan(0)

  const svg = getSvgFromGraphicsObject(solver.finalVisualize())
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
