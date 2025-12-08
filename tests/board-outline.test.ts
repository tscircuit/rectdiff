import { expect, test } from "bun:test"
import boardWithCutout from "../test-assets/board-with-cutout.json"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"
import { getSvgFromGraphicsObject } from "graphics-debug"

test("board outline snapshot", async () => {
  const solver = new RectDiffSolver({
    simpleRouteJson: boardWithCutout as any,
  })

  // Run to completion
  solver.solve()

  const viz = solver.visualize()
  const svg = getSvgFromGraphicsObject(viz)

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
