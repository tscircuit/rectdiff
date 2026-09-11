import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import input from "./input.json"

test("RV1106 free regions across the inner copper pour", async () => {
  const solver = new RectDiffPipeline(input)
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  const sharedNodes = solver
    .getOutput()
    .meshNodes.filter(
      (node) =>
        !node._containsObstacle &&
        node.availableZ.includes(0) &&
        node.availableZ.includes(2),
    )
  expect(sharedNodes.length).toBeGreaterThan(0)
  const graphics = solver.visualize()
  graphics.rects = [
    ...(graphics.rects ?? []),
    ...sharedNodes.map((node) => ({
      center: node.center,
      width: node.width,
      height: node.height,
      fill: "rgba(16, 185, 129, 0.35)",
      stroke: "rgba(5, 150, 105, 0.6)",
    })),
  ]
  graphics.texts = [
    {
      x: 0,
      y: 26,
      text: `Shared top/inner2 free regions: ${sharedNodes.length}`,
      fontSize: 1,
    },
  ]
  const svg = getSvgFromGraphicsObject(graphics, {
    svgWidth: 900,
    svgHeight: 900,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
