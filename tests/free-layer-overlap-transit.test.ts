import { expect, test } from "bun:test"
import { refineFreeLayerOverlaps } from "lib/solvers/RectDiffExpansionSolver/refineFreeLayerOverlaps"
import type { Rect3d } from "lib/rectdiff-types"
import type { SimpleRouteJson } from "lib/types/srj-types"

test("free-layer refinement preserves remainders and rejects blocked or narrow transit", () => {
  const rects: Rect3d[] = [
    {
      minX: 0,
      minY: 0,
      maxX: 2,
      maxY: 2,
      zLayers: [0],
    },
    {
      minX: 1,
      minY: 0,
      maxX: 3,
      maxY: 2,
      zLayers: [2, 3],
    },
  ]
  const simpleRouteJson: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 3, minY: 0, maxY: 2 },
    layerCount: 4,
    minTraceWidth: 0.15,
    minViaDiameter: 0.3,
    connections: [],
    obstacles: [
      {
        type: "rect",
        center: { x: 1.5, y: 1 },
        width: 3,
        height: 2,
        layers: ["inner1"],
        connectedTo: [],
        isCopperPour: true,
      },
    ],
  }
  const input = {
    rects,
    simpleRouteJson,
    zIndexByName: new Map([
      ["top", 0],
      ["inner1", 1],
      ["inner2", 2],
      ["bottom", 3],
    ]),
  }
  const refined = refineFreeLayerOverlaps(input)
  expect(refined).toHaveLength(3)
  expect(refined.find((node) => node.zLayers.length === 3)).toMatchObject({
    minX: 1,
    minY: 0,
    maxX: 2,
    maxY: 2,
    zLayers: [0, 2, 3],
  })
  expect(refined.find((node) => node.zLayers.length === 1)).toMatchObject({
    minX: 0,
    minY: 0,
    maxX: 1,
    maxY: 2,
    zLayers: [0],
  })
  expect(refined.find((node) => node.zLayers.length === 2)).toMatchObject({
    minX: 2,
    minY: 0,
    maxX: 3,
    maxY: 2,
    zLayers: [2, 3],
  })
  const solid = structuredClone(input)
  solid.simpleRouteJson.obstacles[0]!.isCopperPour = false
  expect(refineFreeLayerOverlaps(solid)).toEqual(rects)
  const uncovered = structuredClone(input)
  uncovered.simpleRouteJson.obstacles[0]!.width = 0.5
  expect(refineFreeLayerOverlaps(uncovered)).toEqual(rects)
  const narrow = structuredClone(input)
  narrow.rects[1]!.minX = 1.9
  expect(refineFreeLayerOverlaps(narrow)).toEqual(narrow.rects)
  const clearanceNarrow = structuredClone(input)
  clearanceNarrow.rects[1]!.minX = 1.5
  clearanceNarrow.simpleRouteJson.minViaDiameter = 0.45
  expect(
    refineFreeLayerOverlaps({ ...clearanceNarrow, obstacleClearance: 0.1 }),
  ).toEqual(clearanceNarrow.rects)
  const touching = structuredClone(input)
  touching.rects[1]!.minX = 2
  expect(refineFreeLayerOverlaps(touching)).toEqual(touching.rects)
  const target = structuredClone(input)
  target.rects[0]!.isObstacle = true
  expect(refineFreeLayerOverlaps(target)).toEqual(target.rects)
})
