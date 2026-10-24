import { expect, test } from "bun:test"
import { mergeCoincidentGapFillNodes } from "../lib/solvers/GapFillSolver/mergeCoincidentGapFillNodes"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

test("coalescing preserves layer area, input order, copper and missing-layer barriers", (): void => {
  const nodes: CapacityMeshNode[] = [0, 1, 2, 3].map(
    (z): CapacityMeshNode => ({
      capacityMeshNodeId: `gap-${z}`,
      center: { x: 1, y: 1 },
      width: 2,
      height: 2,
      layer: `z${z}`,
      availableZ: [z],
    }),
  )
  const original = structuredClone(nodes)
  const merged = mergeCoincidentGapFillNodes({ nodes, layerCount: 4 })
  expect(merged).toHaveLength(1)
  expect(merged[0]?.capacityMeshNodeId).toBe("gap-0")
  expect(merged[0]?.availableZ).toEqual([0, 1, 2, 3])
  for (const z of [0, 1, 2, 3]) {
    expect(
      merged
        .filter((node): boolean => node.availableZ.includes(z))
        .reduce((area, node): number => area + node.width * node.height, 0),
    ).toBe(4)
  }
  const nearCoincident = structuredClone(nodes)
  nearCoincident[3]!.center.x += 1e-8
  const hasCopper = structuredClone(nodes)
  hasCopper[2]!._containsObstacle = true
  const hasTarget = structuredClone(nodes)
  hasTarget[2]!._containsTarget = true
  const hasOwnership = structuredClone(nodes)
  hasOwnership[2]!._connectedTo = ["reserved-net"]
  const interleaved = [
    nodes[0]!,
    { ...nodes[3]!, center: { x: 10, y: 1 } },
    nodes[1]!,
  ]
  for (const separated of [
    nodes.filter((node): boolean => node.availableZ[0] !== 2),
    nearCoincident,
    hasCopper,
    hasTarget,
    hasOwnership,
    interleaved,
  ]) {
    const output = mergeCoincidentGapFillNodes({
      nodes: separated,
      layerCount: 4,
    })
    expect(output).toEqual(separated)
    for (let index = 0; index < separated.length; index++) {
      expect(output[index]).toBe(separated[index])
    }
  }
  expect(nodes).toEqual(original)
})
