import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"

test("gap filling uses the caller's physical via diameter", (): void => {
  for (const viaDiameter of [undefined, 0.5]) {
    const solver = new RectDiffPipeline({
      simpleRouteJson: {
        bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
        layerCount: 2,
        minTraceWidth: 0.15,
        minViaDiameter: 0.4,
        obstacles: [],
        connections: [],
      },
      viaDiameter,
      maxGapFillPasses: 1,
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.gapFillSolver?.inputProblem.viaDiameter).toBe(
      viaDiameter ?? 0.4,
    )
  }
})
