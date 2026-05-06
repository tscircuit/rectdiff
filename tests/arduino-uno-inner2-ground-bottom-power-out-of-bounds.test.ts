import { expect, test } from "bun:test"
import simpleRouteJson from "../test-assets/arduino-uno-inner2-ground-bottom-power-out-of-bounds.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"

test("arduino out-of-bounds fixture does not create a generated node outside the board bounds", () => {
  const solver = new RectDiffPipeline({ simpleRouteJson })

  solver.solve()

  const { meshNodes } = solver.getOutput()
  const outsideGeneratedNodes = meshNodes.filter((node) => {
    if (!node.capacityMeshNodeId.startsWith("new-")) return false

    const minX = node.center.x - node.width / 2
    const maxX = node.center.x + node.width / 2
    const minY = node.center.y - node.height / 2
    const maxY = node.center.y + node.height / 2

    return (
      minX < simpleRouteJson.bounds.minX ||
      maxX > simpleRouteJson.bounds.maxX ||
      minY < simpleRouteJson.bounds.minY ||
      maxY > simpleRouteJson.bounds.maxY
    )
  })

  expect(solver.solved).toBe(true)
  expect(meshNodes.length).toBeGreaterThan(0)
  expect(outsideGeneratedNodes).toHaveLength(0)
})
