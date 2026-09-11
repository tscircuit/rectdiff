import { expect, test } from "bun:test"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import type { SimpleRouteJson } from "lib/types/srj-types"

test("outer-layer promotion preserves free routing area and existing layer transitions", async (): Promise<void> => {
  const fixturePaths = [
    "tests/solver/bugreport24-05597c/bugreport24-05597c.json",
    "tests/solver/bugreport22-2a75ce/bugreport22-2a75ce.json",
    "test-assets/arduino-uno-inner2-ground-inner1-power.json",
    "test-assets/arduino-uno-inner2-ground-bottom-power.json",
  ]
  for (const fixturePath of fixturePaths) {
    const fixture: SimpleRouteJson | { simple_route_json: SimpleRouteJson } =
      await Bun.file(new URL(`../../${fixturePath}`, import.meta.url)).json()
    const simpleRouteJson =
      "simple_route_json" in fixture ? fixture.simple_route_json : fixture
    const solver = new RectDiffPipeline({
      simpleRouteJson,
      maxGapFillPasses: 1,
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    const originalNodes = solver.gapFillSolver!.getOutput().outputNodes
    const outputNodes = solver.getOutput().meshNodes
    for (let z = 0; z < simpleRouteJson.layerCount; z++) {
      const [originalArea, outputArea] = [originalNodes, outputNodes].map(
        (nodes) =>
          nodes
            .filter(
              (node) =>
                node.availableZ.includes(z) &&
                !node._containsTarget &&
                !node._containsObstacle,
            )
            .reduce((area, node) => area + node.width * node.height, 0),
      )
      expect(outputArea!).toBeCloseTo(originalArea!, 8)
      for (let otherZ = z + 1; otherZ < simpleRouteJson.layerCount; otherZ++) {
        const [originalViaArea, outputViaArea] = [
          originalNodes,
          outputNodes,
        ].map((nodes) =>
          nodes
            .filter(
              (node) =>
                node.availableZ.includes(z) &&
                node.availableZ.includes(otherZ) &&
                !node._containsTarget &&
                !node._containsObstacle,
            )
            .reduce((area, node) => area + node.width * node.height, 0),
        )
        expect(outputViaArea! + 1e-8).toBeGreaterThanOrEqual(originalViaArea!)
      }
    }
  }
})
