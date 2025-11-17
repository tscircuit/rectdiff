import { expect, test } from "bun:test"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"
import type { SimpleRouteJson } from "../lib/types/srj-types"

test("RectDiffSolver supports incremental stepping", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 5 },
        width: 2,
        height: 2,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 2,
    minTraceWidth: 0.15,
  }

  const solver = new RectDiffSolver({ simpleRouteJson })

  // Setup initializes state
  solver.setup()
  expect(solver.solved).toBe(false)
  expect(solver.stats.phase).toBe("GRID")

  // Step advances one candidate at a time
  let stepCount = 0
  const maxSteps = 1000 // safety limit

  while (!solver.solved && stepCount < maxSteps) {
    solver.step()
    stepCount++

    // Progress should increase (or stay at 1.0 when done)
    if (!solver.solved) {
      expect(solver.stats.phase).toBeDefined()
    }
  }

  expect(solver.solved).toBe(true)
  expect(stepCount).toBeGreaterThan(0)
  expect(stepCount).toBeLessThan(maxSteps)

  const output = solver.getOutput()
  expect(output.meshNodes.length).toBeGreaterThan(0)
})

test("RectDiffSolver.solve() still works (backward compatibility)", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    obstacles: [],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.1,
  }

  const solver = new RectDiffSolver({ simpleRouteJson })

  // Old-style: just call solve()
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(output.meshNodes.length).toBeGreaterThan(0)
})

test("RectDiffSolver exposes progress during solve", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 20, minY: 0, maxY: 20 },
    obstacles: [],
    connections: [],
    layerCount: 3,
    minTraceWidth: 0.2,
  }

  const solver = new RectDiffSolver({ simpleRouteJson })
  solver.setup()

  const progressValues: number[] = []

  // Step and collect progress
  for (let i = 0; i < 20 && !solver.solved; i++) {
    solver.step()
    const progress = solver.computeProgress()
    progressValues.push(progress)
  }

  // Progress should generally increase (or stay at 1.0)
  expect(progressValues.length).toBeGreaterThan(0)
  expect(progressValues[0]).toBeGreaterThanOrEqual(0)
  expect(progressValues[0]).toBeLessThanOrEqual(1)

  // Finish
  solver.solve()
  expect(solver.computeProgress()).toBe(1)
})
