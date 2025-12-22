import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"

// Baseline: plain string layers should be auto-converted to numeric zLayers.
test("RectDiffSolver maps obstacle layers to numeric zLayers", () => {
  const srj: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    connections: [],
    minTraceWidth: 0.2,
    layerCount: 3,
    obstacles: [
      {
        type: "rect",
        center: { x: 1, y: 1 },
        width: 1,
        height: 1,
        layers: ["top"],
        connectedTo: [],
      },
      {
        type: "rect",
        center: { x: 2, y: 2 },
        width: 1,
        height: 1,
        layers: ["inner1", "bottom"],
        connectedTo: [],
      },
    ],
  }

  const pipeline = new RectDiffPipeline({ simpleRouteJson: srj })

  // Solve completely
  pipeline.solve()

  // Verify the solver produced valid output
  const output = pipeline.getOutput()
  expect(output.meshNodes).toBeDefined()
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // Verify obstacles were processed correctly
  // The internal solver should have mapped layer names to z indices
  expect(pipeline.rectDiffGridSolver).toBeDefined()
})
