import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import stallingBugReport from "../test-assets/bugreport-c7537683-stalling.json"
import type { SimpleRouteJson } from "../lib/types/srj-types"

/**
 * Bug #518: RectDiff Stalling Issue
 *
 * The expandRectFromSeed() function had an unbounded while (improved) loop
 * with no max iteration guard. Combined with floating-point precision
 * mismatches from mixed precision coordinates (4 decimals like -2.4625
 * mixed with 14+ decimals like 34.09920366859815), this could cause infinite
 * looping where expansions would succeed by infinitesimal amounts.
 *
 * Fix: Added MAX_ITERATIONS guard (1000) and MIN_EXPANSION threshold (1e-6)
 * to the expansion loop.
 */
test("Bug #518: RectDiff solver completes without stalling on mixed-precision coordinates", () => {
  const simpleRouteJson = stallingBugReport as SimpleRouteJson

  const pipeline = new RectDiffPipeline({ simpleRouteJson })

  // Setup initializes state
  pipeline.setup()
  expect(pipeline.solved).toBe(false)

  // Step advances one candidate at a time
  // This test ensures the solver completes within a reasonable number of steps
  let stepCount = 0
  const maxSteps = 10000 // safety limit

  while (!pipeline.solved && stepCount < maxSteps) {
    pipeline.step()
    stepCount++
  }

  expect(pipeline.solved).toBe(true)
  expect(stepCount).toBeLessThan(maxSteps)

  const output = pipeline.getOutput()
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // Verify mesh nodes have valid dimensions
  for (const node of output.meshNodes) {
    expect(node.width).toBeGreaterThan(0)
    expect(node.height).toBeGreaterThan(0)
  }
})

test("Bug #518: expandRectFromSeed iteration guard prevents infinite loops", () => {
  // Test with a simple case that would complete quickly
  // This validates the iteration guard doesn't break normal operation
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 10,
      minY: 0,
      maxY: 10,
    },
    obstacles: [
      // Create tightly-packed obstacles similar to QFP pads
      // with mixed precision to simulate the bug conditions
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.4625, y: 2.5 }, // 4 decimal places
        width: 0.5,
        height: 0.25,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.4625, y: 3.0 },
        width: 0.5,
        height: 0.25,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.4625, y: 3.5 },
        width: 0.5,
        height: 0.25,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 2,
    minTraceWidth: 0.15,
  }

  const pipeline = new RectDiffPipeline({ simpleRouteJson })

  // Should complete without hanging
  pipeline.solve()

  expect(pipeline.solved).toBe(true)

  const output = pipeline.getOutput()
  expect(output.meshNodes.length).toBeGreaterThan(0)
})
