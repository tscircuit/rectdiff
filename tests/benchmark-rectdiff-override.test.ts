import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { createSolver } from "../scripts/benchmark/benchmark-child/createSolver"
import type { SimpleRouteJson } from "../lib/types/srj-types"

const SENTINEL_ERROR = "FAKE_RECTDIFF_PIPELINE_USED"

class FakeRectDiffPipeline extends RectDiffPipeline {
  constructor(...args: ConstructorParameters<typeof RectDiffPipeline>) {
    super(...args)
    throw new Error(SENTINEL_ERROR)
  }
}

test("benchmark createSolver uses an injected fake RectDiff override", async () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 10,
      minY: 0,
      maxY: 10,
    },
    obstacles: [],
    connections: [],
    layerCount: 2,
    minTraceWidth: 0.15,
  }

  const solver = await createSolver(simpleRouteJson, FakeRectDiffPipeline)

  while (!solver.failed && solver.getCurrentPhase() !== "nodeSolver") {
    solver.step()
  }

  expect(solver.getCurrentPhase()).toBe("nodeSolver")
  expect(solver.failed).toBe(false)

  expect(() => solver.step()).toThrow(SENTINEL_ERROR)
  expect(solver.failed).toBe(true)
  expect(solver.error).toContain(SENTINEL_ERROR)
}, 60_000)
