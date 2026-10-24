import { expect, test } from "bun:test"
import { mergeCoincidentGapFillNodes } from "../lib/solvers/GapFillSolver/mergeCoincidentGapFillNodes"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"

test("gaps smaller than the physical via stay layer-separated", (): void => {
  for (const { width, height, minViaDiameter } of [
    { width: 0.29, height: 2, minViaDiameter: 0.3 },
    { width: 2, height: 0.29, minViaDiameter: 0.3 },
    { width: 0.49, height: 2, minViaDiameter: 0.5 },
    { width: 2, height: 0.49, minViaDiameter: 0.5 },
  ]) {
    const nodes: CapacityMeshNode[] = [0, 1].map(
      (z): CapacityMeshNode => ({
        capacityMeshNodeId: `gap-${z}`,
        center: { x: 0, y: 0 },
        width,
        height,
        layer: `z${z}`,
        availableZ: [z],
      }),
    )
    const output = mergeCoincidentGapFillNodes({
      nodes,
      layerCount: 2,
      minViaDiameter,
    })
    expect(output).toEqual(nodes)
    expect(output[0]).toBe(nodes[0])
    expect(output[1]).toBe(nodes[1])
    const fitting = nodes.map(
      (node): CapacityMeshNode => ({
        ...node,
        width: minViaDiameter,
        height: minViaDiameter,
      }),
    )
    expect(
      mergeCoincidentGapFillNodes({
        nodes: fitting,
        layerCount: 2,
        minViaDiameter,
      }).map((node): number[] => node.availableZ),
    ).toEqual([[0, 1]])
  }
})
