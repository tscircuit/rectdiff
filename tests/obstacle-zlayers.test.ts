import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"

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

  const solver = new RectDiffSolver({ simpleRouteJson: srj, mode: "grid" })
  solver.setup()

  expect(srj.obstacles[0]?.zLayers).toEqual([0])
  expect(srj.obstacles[1]?.zLayers).toEqual([1, 2])
})
