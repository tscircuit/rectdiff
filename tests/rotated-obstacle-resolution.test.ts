import { expect, test } from "bun:test"
import { getBounds, getSvgFromGraphicsObject } from "graphics-debug"
import { buildRotatedObstacleResolutionStackedGraphic } from "../lib/fixtures/rotatedObstacleResolutionFixture"

test("rotated obstacle resolution sweep", async () => {
  const { panels, graphics } = buildRotatedObstacleResolutionStackedGraphic()
  const bounds = getBounds(graphics)
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const svgWidth = 960
  const svgHeight = Math.max(svgWidth, Math.ceil((height / width) * svgWidth))
  const svg = getSvgFromGraphicsObject(graphics, {
    svgWidth,
    svgHeight,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)

  expect(panels.length).toBeGreaterThanOrEqual(3)
  expect(
    panels.some((panel) =>
      panel.graphics.rects?.some((rect) => rect.ccwRotationDegrees === 33),
    ),
  ).toBe(true)

  for (let index = 1; index < panels.length; index++) {
    expect(panels[index]!.metrics.obstacleRectCount).toBeGreaterThanOrEqual(
      panels[index - 1]!.metrics.obstacleRectCount,
    )
    expect(panels[index]!.metrics.missedObstacleArea).toBeLessThanOrEqual(
      panels[index - 1]!.metrics.missedObstacleArea + 0.05,
    )
    expect(panels[index]!.metrics.freeOverlapArea).toBeLessThanOrEqual(
      panels[index - 1]!.metrics.freeOverlapArea + 0.05,
    )
  }
})
