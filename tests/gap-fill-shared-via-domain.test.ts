import { expect, test } from "bun:test"
import { GapFillSolverPipeline } from "../lib/solvers/GapFillSolver/GapFillSolverPipeline"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

test("coincident free gap regions retain a through-via domain", (): void => {
  const layers = [0, 1, 2, 3]
  const seed: CapacityMeshNode = {
    capacityMeshNodeId: "seed",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    availableZ: layers,
    layer: "z0,1,2,3",
  }
  const solver = new GapFillSolverPipeline({
    bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    meshNodes: [seed],
    boardVoid: { boardVoidRects: [], layerCount: layers.length },
    maxGapFillPasses: 1,
  })
  solver.solve()
  const gapNodes = solver
    .getOutput()
    .outputNodes.filter(
      (node): boolean => node.center.x === 3 && node.center.y === 0,
    )

  expect(solver.solved).toBe(true)
  expect(gapNodes.map((node): number[] => node.availableZ)).toEqual([layers])
  expect(seed.availableZ).toEqual(layers)
})
