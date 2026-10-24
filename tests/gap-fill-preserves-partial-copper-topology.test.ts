import { expect, test } from "bun:test"
import { GapFillSolverPipeline } from "../lib/solvers/GapFillSolver/GapFillSolverPipeline"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

test("callers modeling other copper separately can retain the original gap layers", (): void => {
  const seed: CapacityMeshNode = {
    capacityMeshNodeId: "seed",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    availableZ: [0, 1, 2, 3],
    layer: "z0,1,2,3",
  }
  const solver = new GapFillSolverPipeline({
    bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    meshNodes: [seed],
    boardVoid: { boardVoidRects: [], layerCount: 4 },
    maxGapFillPasses: 1,
    mergeGapFillLayers: false,
  })
  solver.solve()
  const gapNodes = solver.getOutput().outputNodes.filter(
    (node): boolean => node.center.x === 3 && node.center.y === 0,
  )
  expect(gapNodes.map((node): number[] => node.availableZ)).toEqual([
    [0],
    [1],
    [2],
    [3],
  ])
  expect(solver.getOutput().outputNodes[0]).toBe(seed)
})
