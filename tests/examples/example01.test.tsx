import { expect, test } from "bun:test"
import simpleRouteJson from "../../test-assets/example-simple-route.json"
import { RectDiffSolver } from "../../lib/solvers/RectDiffSolver"
import { getSvgFromGraphicsObject } from "graphics-debug"

test("example01", () => {
  const solver = new RectDiffSolver({ simpleRouteJson })

  solver.solve()

  expect(getSvgFromGraphicsObject(solver.visualize())).toMatchSvgSnapshot(
    import.meta.path,
  )
})
