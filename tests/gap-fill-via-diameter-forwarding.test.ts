import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"

test("gap filling uses the physical via and remaining clearance", (): void => {
  for (const {
    viaDiameter,
    viaClearance,
    defaultObstacleMargin,
    obstacleClearance,
    expectedClearance,
  } of [
    { expectedClearance: 0.15 },
    { viaDiameter: 0.5, viaClearance: 0.2, expectedClearance: 0.2 },
    {
      viaDiameter: 0.5,
      viaClearance: 0.2,
      obstacleClearance: 0.1,
      expectedClearance: 0.1,
    },
    {
      viaClearance: 0.15,
      obstacleClearance: 0.2,
      expectedClearance: 0,
    },
    { viaClearance: 0, expectedClearance: 0 },
    { obstacleClearance: -0.1, expectedClearance: 0.15 },
    { defaultObstacleMargin: 0.1, expectedClearance: 0.1 },
  ]) {
    const solver = new RectDiffPipeline({
      simpleRouteJson: {
        bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
        layerCount: 2,
        minTraceWidth: 0.15,
        minViaDiameter: 0.4,
        minViaEdgeToPadEdgeClearance: viaClearance,
        defaultObstacleMargin,
        obstacles: [],
        connections: [],
      },
      viaDiameter,
      obstacleClearance,
      maxGapFillPasses: 1,
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.gapFillSolver?.inputProblem.viaDiameter).toBe(
      viaDiameter ?? 0.4,
    )
    expect(solver.gapFillSolver?.inputProblem.viaClearance).toBeCloseTo(
      expectedClearance,
      10,
    )
  }
})
