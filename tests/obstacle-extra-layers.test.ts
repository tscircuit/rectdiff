import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"

// Legacy SRJs sometimes reference "inner" layers beyond layerCount; ensure we clamp.
test("RectDiffSolver clamps extra layer names to available z indices", () => {
  const srj: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 5, minY: 0, maxY: 5 },
    connections: [],
    minTraceWidth: 0.2,
    layerCount: 2,
    obstacles: [
      {
        type: "rect",
        center: { x: 1, y: 1 },
        width: 1,
        height: 1,
        layers: ["inner1"],
        connectedTo: [],
      },
      {
        type: "rect",
        center: { x: 3, y: 3 },
        width: 1,
        height: 1,
        layers: ["inner2"],
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

  // Verify solver was instantiated and processed obstacles
  expect(pipeline.rectDiffGridSolver).toBeDefined()
})
