import { expect, test } from "bun:test"
import { ExpandEdgesToEmptySpaceSolver } from "../lib/solvers/GapFillSolver/ExpandEdgesToEmptySpaceSolver"
import { EDGES } from "../lib/solvers/GapFillSolver/edge-constants"
import { GapFillSolverPipeline } from "../lib/solvers/GapFillSolver/GapFillSolverPipeline"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

const parent: CapacityMeshNode = {
  capacityMeshNodeId: "seed",
  center: { x: 0, y: 0 },
  width: 2,
  height: 2,
  availableZ: [0],
  layer: "top",
}
const bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }

for (const edge of EDGES) {
  test(`gap fill reaches ${edge.facingDirection} board edge without a blocker`, () => {
    const solver = new ExpandEdgesToEmptySpaceSolver({
      bounds,
      inputMeshNodes: [parent],
      segmentsWithAdjacentEmptySpace: [
        {
          parent,
          z: 0,
          facingDirection: edge.facingDirection,
          start: { x: edge.startX * 2, y: edge.startY * 2 },
          end: { x: edge.endX * 2, y: edge.endY * 2 },
        },
      ],
    })
    solver.solve()
    const nodes = solver.getOutput().expandedSegments
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.newNode.width * nodes[0]!.newNode.height).toBeCloseTo(8)
    expect(nodes[0]!.newNode.center).toEqual({ x: edge.dx * 3, y: edge.dy * 3 })
  })
}

test("bounded recursive gap filling keeps useful space and respects blockers", () => {
  const blocker: CapacityMeshNode = {
    ...parent,
    capacityMeshNodeId: "blocker",
    center: { x: 3, y: 0 },
    width: 1,
  }
  const solver = new GapFillSolverPipeline({
    bounds,
    meshNodes: [parent, blocker],
    maxGapFillPasses: 3,
  })
  solver.solve()
  const generated = solver
    .getOutput()
    .outputNodes.filter((n) => n.capacityMeshNodeId.startsWith("new-"))
  expect(generated.length).toBeGreaterThan(0)
  for (const n of generated) {
    expect(n.center.x - n.width / 2).toBeGreaterThanOrEqual(-5)
    expect(n.center.y - n.height / 2).toBeGreaterThanOrEqual(-5)
    expect(n.center.x + n.width / 2).toBeLessThanOrEqual(5)
    expect(n.center.y + n.height / 2).toBeLessThanOrEqual(5)
    const overlapX =
      Math.min(n.center.x + n.width / 2, 3.5) -
      Math.max(n.center.x - n.width / 2, 2.5)
    const overlapY =
      Math.min(n.center.y + n.height / 2, 1) -
      Math.max(n.center.y - n.height / 2, -1)
    expect(overlapX <= 1e-8 || overlapY <= 1e-8).toBe(true)
  }
})

test("seed spanning the board edge only grows from its in-board portion", () => {
  const solver = new ExpandEdgesToEmptySpaceSolver({
    bounds,
    inputMeshNodes: [parent],
    segmentsWithAdjacentEmptySpace: [
      {
        parent,
        z: 0,
        facingDirection: "x+",
        start: { x: 1, y: -8 },
        end: { x: 1, y: 8 },
      },
    ],
  })
  solver.solve()
  expect(solver.getOutput().expandedSegments[0]!.newNode).toMatchObject({
    center: { x: 3, y: 0 },
    width: 4,
    height: 10,
  })
})

test("outline void clearance still stops expansion before the board edge", () => {
  const solver = new ExpandEdgesToEmptySpaceSolver({
    bounds,
    inputMeshNodes: [parent],
    boardVoid: {
      layerCount: 2,
      boardVoidRects: [{ x: 4.8, y: -5, width: 0.4, height: 10 }],
    },
    segmentsWithAdjacentEmptySpace: [
      {
        parent,
        z: 0,
        facingDirection: "x+",
        start: { x: 1, y: -1 },
        end: { x: 1, y: 1 },
      },
    ],
  })
  solver.solve()
  const node = solver.getOutput().expandedSegments[0]!.newNode
  expect(node.center.x + node.width / 2).toBeCloseTo(4.8)
})

test("a distant blocker is found before filling a large bounded board", () => {
  const blocker = {
    ...parent,
    capacityMeshNodeId: "distant",
    center: { x: 2000, y: 0 },
  }
  const solver = new ExpandEdgesToEmptySpaceSolver({
    bounds: { ...bounds, maxX: 5000 },
    inputMeshNodes: [parent, blocker],
    segmentsWithAdjacentEmptySpace: [
      {
        parent,
        z: 0,
        facingDirection: "x+",
        start: { x: 1, y: -1 },
        end: { x: 1, y: 1 },
      },
    ],
  })
  solver.solve()
  const node = solver.getOutput().expandedSegments[0]!.newNode
  expect(node.center.x + node.width / 2).toBeCloseTo(1999)
})

test("a zero-length seed creates no node", () => {
  const solver = new ExpandEdgesToEmptySpaceSolver({
    bounds,
    inputMeshNodes: [parent],
    segmentsWithAdjacentEmptySpace: [
      {
        parent,
        z: 0,
        facingDirection: "x+",
        start: { x: 1, y: 0 },
        end: { x: 1, y: 0 },
      },
    ],
  })
  solver.solve()
  expect(solver.getOutput().expandedSegments).toEqual([])
})
