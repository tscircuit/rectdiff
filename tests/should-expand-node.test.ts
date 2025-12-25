import { expect, test } from "bun:test"
import middleGapFixture from "test-assets/gap-fill-h-shape-should-expand-node.json"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { GapFillSolverPipeline } from "lib/solvers/GapFillSolver/GapFillSolverPipeline"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import { makeCapacityMeshNodeWithLayerInfo } from "./fixtures/makeCapacityMeshNodeWithLayerInfo"

test("should expand capacityMeshNode to fill the gap", async () => {
  const solver = new GapFillSolverPipeline({
    meshNodes: middleGapFixture.meshNodes as CapacityMeshNode[],
  })

  solver.solve()

  const { outputNodes } = solver.getOutput()

  expect(outputNodes.length).toBeGreaterThanOrEqual(
    middleGapFixture.meshNodes.length,
  )

  const finalGraphics = makeCapacityMeshNodeWithLayerInfo(outputNodes)
  const svg = getSvgFromGraphicsObject(
    { rects: finalGraphics.values().toArray().flat() },
    {
      svgWidth: 640,
      svgHeight: 480,
    },
  )

  // More means we have added new nodes to fill the gap
  expect(outputNodes.length).toEqual(3)

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
