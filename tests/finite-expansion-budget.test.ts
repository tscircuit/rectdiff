import { expect, test } from "bun:test"
import { ExpandEdgesToEmptySpaceSolver } from "../lib/solvers/GapFillSolver/ExpandEdgesToEmptySpaceSolver"
import type { SegmentWithAdjacentEmptySpace } from "../lib/solvers/GapFillSolver/FindSegmentsWithAdjacentEmptySpaceSolver"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

test("finite expansion processes every boundary segment", () => {
  const parent: CapacityMeshNode = {
    capacityMeshNodeId: "boundary",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    layer: "top",
    availableZ: [0],
  }
  const count = 100001
  const segments: SegmentWithAdjacentEmptySpace[] = Array.from(
    { length: count },
    (_, i) => ({
      parent,
      start: { x: 0.5, y: -0.5 + i / count },
      end: { x: 0.5, y: -0.5 + (i + 1) / count },
      z: 0,
      facingDirection: "x+",
    }),
  )
  const solver = new ExpandEdgesToEmptySpaceSolver({
    bounds: { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 },
    inputMeshNodes: [parent],
    segmentsWithAdjacentEmptySpace: segments,
  })
  solver.solve()
  expect({
    solved: solver.solved,
    failed: solver.failed,
    error: solver.error,
  }).toMatchObject({ solved: true, failed: false })
  expect(solver.unprocessedSegments).toHaveLength(0)
  expect(solver.expandedSegments).toHaveLength(0)
})
