import { makeBoardBoundsSnapshot } from "./fixtures/makeBoardBoundsSnapshot"
import { expect, test } from "bun:test"
import simpleRouteJson from "../test-assets/simplified-out-of-bounds-example.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"

test("simplified out-of-bounds fixture keeps generated nodes within the board bounds", async () => {
  const solver = new RectDiffPipeline({ simpleRouteJson, maxGapFillPasses: 1 })

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
  expect(outsideGeneratedNodes).toEqual([])
  // The grid already fills this board; the only old addition was outside it.
  expect(meshNodes.length).toBe(
    solver.rectDiffGridSolverPipeline!.getOutput().meshNodes.length,
  )
  await expect(makeBoardBoundsSnapshot(meshNodes)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
