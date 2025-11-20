import { expect, test } from "bun:test"
import simpleRouteJson from "../../test-assets/example01.json"
import { RectDiffSolver } from "../../lib/solvers/RectDiffSolver"
import { getSvgFromGraphicsObject } from "graphics-debug"

test.skip("example01", () => {
  const solver = new RectDiffSolver({ simpleRouteJson })

  solver.solve()

  expect(getSvgFromGraphicsObject(solver.visualize())).toMatchSvgSnapshot(
    import.meta.path,
  )

  // Gap detection test - check coverage with a fine grid
  const bounds = simpleRouteJson.bounds
  const step = 0.004
  const layerCount = simpleRouteJson.layerCount || 2
  const state = (solver as any).state
  const obstacles = state.obstaclesByLayer
  const placed = state.placed

  const gapPoints: Array<{ x: number; y: number; z: number }> = []

  for (let z = 0; z < layerCount; z++) {
    const layerObstacles = obstacles[z] || []
    const layerPlaced = placed
      .filter((p: any) => p.zLayers.includes(z))
      .map((p: any) => p.rect)

    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      for (let y = bounds.minY; y <= bounds.maxY; y += step) {
        // Skip if in obstacle
        if (
          layerObstacles.some(
            (o: any) =>
              x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height,
          )
        )
          continue

        // Check if covered by any placed rectangle
        const covered = layerPlaced.some(
          (r: any) =>
            x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
        )

        if (!covered) {
          gapPoints.push({ x, y, z })
        }
      }
    }
  }

  const totalArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
  const gapArea = gapPoints.length * step * step
  const coveragePercent = ((totalArea - gapArea) / totalArea) * 100

  console.log(
    `Coverage: ${coveragePercent.toFixed(2)}%, Rectangles: ${placed.length}`,
  )

  // We expect >99% coverage (with the improved edge analysis)
  expect(coveragePercent).toBeGreaterThan(99)
})
