import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { comparisonGraphics, solve } from "./fixture"

test("repro: opposite outer nodes are independently promoted onto the same footprint", async () => {
  const output = solve()
  expect(output).toHaveLength(2)
  expect(output.map((n) => n.availableZ)).toEqual([
    [0, 3],
    [0, 3],
  ])
  expect(output[0]!.center).toEqual(output[1]!.center)
  for (const z of [0, 3]) {
    const area = output
      .filter((n) => n.availableZ.includes(z))
      .reduce((sum, n) => sum + n.width * n.height, 0)
    expect(area).toBe(32)
  }
  await expect(
    getSvgFromGraphicsObject(comparisonGraphics(output), {
      svgWidth: 960,
      svgHeight: 1000,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
