import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../../../lib/types/capacity-mesh-types"
import { overlaps } from "../../../lib/utils/rectdiff-geometry"
import { comparisonGraphics, inputNodes, node, solve } from "./fixture"

test("opposite outer nodes produce one shared footprint", async () => {
  const output = solve()
  expect(output).toHaveLength(1)
  expect(output.map((n) => n.availableZ)).toEqual([[0, 3]])
  for (const z of [0, 3]) {
    const area = output
      .filter((n) => n.availableZ.includes(z))
      .reduce((sum, n) => sum + n.width * n.height, 0)
    expect(area).toBe(16)
  }
  await expect(
    getSvgFromGraphicsObject(comparisonGraphics(output), {
      svgWidth: 960,
      svgHeight: 1000,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

function expectPartitionPreserved(input: CapacityMeshNode[]) {
  const output = solve(input)
  const rect = (n: CapacityMeshNode) => ({
    x: n.center.x - n.width / 2,
    y: n.center.y - n.height / 2,
    width: n.width,
    height: n.height,
  })
  for (let i = 0; i < output.length; i++) {
    for (let j = i + 1; j < output.length; j++) {
      if (
        output[i]!.availableZ.some((z) => output[j]!.availableZ.includes(z))
      ) {
        expect(overlaps(rect(output[i]!), rect(output[j]!))).toBe(false)
      }
    }
  }
  for (const z of [0, 3]) {
    const area = (nodes: CapacityMeshNode[]) =>
      nodes
        .filter((n) => n.availableZ.includes(z))
        .reduce((sum, n) => sum + n.width * n.height, 0)
    expect(area(output)).toBeCloseTo(area(input), 9)
  }
  return output
}

test("selection remains safe when opposite candidates arrive in reverse order", () => {
  expect(expectPartitionPreserved([...inputNodes].reverse())).toHaveLength(1)
})

test("nested promotion leaves disjoint single-layer residuals", () => {
  const output = expectPartitionPreserved([
    node("top", 0),
    node("bottom", 3, 1, 2),
  ])
  expect(output.filter((n) => n.availableZ.length === 2)).toHaveLength(1)
  expect(output.filter((n) => n.availableZ.length === 1)).toHaveLength(2)
})

test("touching promotions are retained on both sides of an edge", () => {
  const output = expectPartitionPreserved([
    node("top-left", 0),
    node("bottom-left", 3),
    node("top-right", 0, 4),
    node("bottom-right", 3, 4),
  ])
  expect(output).toHaveLength(2)
  expect(output.every((n) => n.availableZ.join(",") === "0,3")).toBe(true)
})
