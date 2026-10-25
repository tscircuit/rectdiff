import { expect, test } from "bun:test"
import { mergeCoincidentGapFillNodes } from "../lib/solvers/GapFillSolver/mergeCoincidentGapFillNodes"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

test("a through-via gap must fit the pad and its required clearance", (): void => {
  for (const { width, height, viaClearance, expectedCount } of [
    { width: 0.5, height: 2, viaClearance: 0.15, expectedCount: 4 },
    { width: 2, height: 0.5, viaClearance: 0.15, expectedCount: 4 },
    { width: 0.6, height: 0.6, viaClearance: 0.15, expectedCount: 1 },
    { width: 0.6, height: 0.6, viaClearance: 0.2, expectedCount: 4 },
    { width: 0.3, height: 0.3, viaClearance: 0, expectedCount: 1 },
  ]) {
    const nodes: CapacityMeshNode[] = [0, 1, 2, 3].map(
      (z): CapacityMeshNode => ({
        capacityMeshNodeId: `gap-${z}`,
        center: { x: 0, y: 0 },
        width,
        height,
        layer: `z${z}`,
        availableZ: [z],
      }),
    )
    const original = structuredClone(nodes)
    const output = mergeCoincidentGapFillNodes({
      nodes,
      layerCount: 4,
      minViaDiameter: 0.3,
      viaClearance,
    })
    expect(output).toHaveLength(expectedCount)
    expect(nodes).toEqual(original)
    if (expectedCount === 4) expect(output).toEqual(nodes)
    else expect(output[0]!.availableZ).toEqual([0, 1, 2, 3])
  }
})
