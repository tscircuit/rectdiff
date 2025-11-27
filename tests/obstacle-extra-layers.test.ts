import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"

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

  const solver = new RectDiffSolver({ simpleRouteJson: srj })
  solver.setup()

  expect(srj.obstacles[0]?.zLayers).toEqual([1])
  expect(srj.obstacles[1]?.zLayers).toEqual([1])
})
