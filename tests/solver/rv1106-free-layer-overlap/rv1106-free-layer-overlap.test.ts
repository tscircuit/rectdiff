import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import input from "./input.json"

test("RV1106 free regions across the inner copper pour", async () => {
  const solver = new RectDiffPipeline(input)
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  const sharedNodes = solver.getOutput().meshNodes.filter(
    (node) =>
      !node._containsObstacle &&
      node.availableZ.includes(0) &&
      node.availableZ.includes(2),
  )
  expect(sharedNodes).toHaveLength(0)
  const svg = getSvgFromGraphicsObject(solver.visualize(), {
    svgWidth: 900,
    svgHeight: 900,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
