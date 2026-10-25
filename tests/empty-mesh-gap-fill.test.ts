import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib"
import { GapFillSolverPipeline } from "../lib/solvers/GapFillSolver/GapFillSolverPipeline"
import { FindSegmentsWithAdjacentEmptySpaceSolver } from "../lib/solvers/GapFillSolver/FindSegmentsWithAdjacentEmptySpaceSolver"

test("a board smaller than the minimum regions produces an empty mesh", () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: {
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      obstacles: [],
      connections: [],
      layerCount: 2,
      minTraceWidth: 0.1,
    },
    gridOptions: {
      minSingle: { width: 2, height: 2 },
      minMulti: { width: 2, height: 2, minLayers: 2 },
    },
    maxGapFillPasses: 1,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.rectDiffGridSolverPipeline?.getOutput().meshNodes).toEqual([])
  expect(solver.getOutput().meshNodes).toEqual([])
})

test("gap filling stops when the mesh has no edges to expand", () => {
  const solver = new GapFillSolverPipeline({
    meshNodes: [],
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    maxGapFillPasses: 3,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().outputNodes).toEqual([])
  expect(solver.passExpandedCounts).toEqual([0])
})

test("an empty mesh has no exposed edge segments", () => {
  const solver = new FindSegmentsWithAdjacentEmptySpaceSolver({
    allMeshNodes: [],
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().segmentsWithAdjacentEmptySpace).toEqual([])
  expect(solver.visualize().lines).toEqual([])
})
