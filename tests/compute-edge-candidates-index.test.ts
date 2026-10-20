import { expect, spyOn, test } from "bun:test"
import Flatbush from "flatbush"
import RBush from "rbush"
import type { XYRect } from "../lib/rectdiff-types"
import { computeEdgeCandidates3D } from "../lib/solvers/RectDiffSeedingSolver/computeEdgeCandidates3D"
import type { RTreeRect } from "../lib/types/capacity-mesh-types"
import { computeEdgeCandidates3DReference } from "./fixtures/computeEdgeCandidates3DReference"

type Layer = {
  obstacles?: XYRect[]
  hard?: XYRect[]
  soft?: XYRect[]
}

type Scenario = {
  name: string
  bounds: XYRect
  minSize: number
  layerCount: number
  layers: Array<Layer | undefined>
}

function makeIndex(rects: XYRect[], z: number): RBush<RTreeRect> {
  return new RBush<RTreeRect>().load(
    rects.map((r) => ({
      ...r,
      minX: r.x,
      minY: r.y,
      maxX: r.x + r.width,
      maxY: r.y + r.height,
      zLayers: [z],
    })),
  )
}

function makeParams(scenario: Scenario) {
  return {
    bounds: scenario.bounds,
    minSize: scenario.minSize,
    layerCount: scenario.layerCount,
    obstacleIndexByLayer: scenario.layers.map((layer, z) =>
      layer ? makeIndex(layer.obstacles ?? [], z) : undefined,
    ),
    placedIndexByLayer: scenario.layers.map((layer, z) =>
      layer
        ? makeIndex([...(layer.hard ?? []), ...(layer.soft ?? [])], z)
        : undefined,
    ),
    hardPlacedByLayer: scenario.layers.map((layer) => layer?.hard ?? []),
  }
}

function makeRandomScenarios(): Scenario[] {
  let state = 0x109bcafe
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
  const integer = (max: number) => Math.floor(random() * max)
  const scenarios: Scenario[] = []

  for (let caseIndex = 0; caseIndex < 80; caseIndex++) {
    const layerCount = 1 + integer(6)
    const bounds = {
      x: -15 + random() * 20,
      y: -15 + random() * 20,
      width: 2 + random() * 35,
      height: 2 + random() * 35,
    }
    const layers: Array<Layer | undefined> = []
    // Some boards have truncated layer arrays as well as explicit missing layers.
    const suppliedLayerCount =
      caseIndex % 7 === 0 ? Math.max(0, layerCount - 1) : layerCount
    for (let z = 0; z < suppliedLayerCount; z++) {
      if (random() < 0.15) {
        layers.push(undefined)
        continue
      }
      const layer: Required<Layer> = { obstacles: [], hard: [], soft: [] }
      const count = integer(38)
      for (let i = 0; i < count; i++) {
        const jitter = (integer(3) - 1) * 0.00000049
        const r = {
          x: bounds.x + (random() * 1.6 - 0.3) * bounds.width + jitter,
          y: bounds.y + (random() * 1.6 - 0.3) * bounds.height - jitter,
          width: i % 9 === 0 ? 0.00000049 : random() * bounds.width * 0.6,
          height: i % 11 === 0 ? 0.00000151 : random() * bounds.height * 0.6,
        }
        const destination = [layer.obstacles, layer.hard, layer.soft][
          integer(3)
        ]!
        destination.push(r)
        if (i % 13 === 0) destination.push({ ...r })
      }
      layers.push(layer)
    }
    scenarios.push({
      name: `seeded board ${caseIndex}`,
      bounds,
      minSize: [0.00000001, 0.05, 0.2, 1, 3][caseIndex % 5]!,
      layerCount,
      layers,
    })
  }
  return scenarios
}

test("indexed edge candidates exactly match exhaustive analysis", () => {
  const duplicate = { x: 4, y: 4, width: 2, height: 2 }
  const scenarios: Scenario[] = [
    {
      name: "empty board with missing and empty layer indexes",
      bounds: { x: 0, y: 0, width: 12, height: 10 },
      minSize: 1,
      layerCount: 4,
      layers: [{}, undefined, {}],
    },
    {
      name: "obstacles, hard placements, soft placements, and duplicate geometry",
      bounds: { x: 0, y: 0, width: 12, height: 10 },
      minSize: 0.5,
      layerCount: 4,
      layers: [
        {
          obstacles: [
            duplicate,
            { ...duplicate },
            { x: 1, y: 1, width: 2, height: 3 },
          ],
          hard: [{ ...duplicate }, { x: 8, y: 2, width: 1, height: 5 }],
          soft: [{ x: 0, y: 0, width: 4, height: 10 }],
        },
        {
          hard: [{ x: 0, y: 0, width: 4, height: 10 }],
          soft: [{ x: 7, y: 0, width: 5, height: 10 }],
        },
        {
          obstacles: [{ x: 0, y: 0, width: 4, height: 10 }],
          soft: [{ x: 7, y: 0, width: 5, height: 10 }],
        },
        { soft: [{ x: 0, y: 0, width: 12, height: 10 }] },
      ],
    },
    {
      name: "fully occupied across obstacles and soft placements",
      bounds: { x: -4, y: -3, width: 12, height: 10 },
      minSize: 0.5,
      layerCount: 3,
      layers: [
        { obstacles: [{ x: -4, y: -3, width: 12, height: 10 }] },
        { hard: [{ x: -4, y: -3, width: 12, height: 10 }] },
        { soft: [{ x: -4, y: -3, width: 12, height: 10 }] },
      ],
    },
    {
      name: "quantization boundaries and subprecision widths",
      bounds: {
        x: -0.00000049,
        y: 0.00000051,
        width: 12.00000049,
        height: 10.00000051,
      },
      minSize: 0.2,
      layerCount: 2,
      layers: [
        {
          obstacles: [
            {
              x: 2.00000049,
              y: 1.99999951,
              width: 0.99999951,
              height: 2.00000049,
            },
            {
              x: 4.00000051,
              y: 3.00000049,
              width: 0.00000049,
              height: 1.00000051,
            },
            {
              x: 6.99999949,
              y: 2.00000051,
              width: 0.00000051,
              height: 3.99999949,
            },
            { x: 0.03, y: 0.03, width: 1.00000049, height: 0.00000149 },
          ],
          hard: [
            {
              x: 9.00000051,
              y: 6.99999951,
              width: 1.00000051,
              height: 0.00000151,
            },
          ],
        },
        { soft: [{ x: 0, y: 0, width: 1, height: 10 }] },
      ],
    },
    {
      name: "disjoint clipped intervals retain their original normalization",
      bounds: { x: 0, y: 0, width: 12, height: 10 },
      minSize: 1,
      layerCount: 2,
      layers: [
        {
          obstacles: [
            { x: 4, y: 4, width: 2, height: 2 },
            { x: 3, y: -5, width: 1, height: 2 },
            { x: 3, y: 8, width: 1, height: 3 },
            { x: -5, y: 3, width: 2, height: 1 },
            { x: 9, y: 3, width: 5, height: 1 },
            { x: -8, y: -1, width: 2, height: 3 },
            { x: 14, y: -1, width: 2, height: 3 },
            { x: -1, y: 14, width: 3, height: 2 },
            { x: -1, y: -6, width: 3, height: 2 },
          ],
        },
        {},
      ],
    },
    {
      name: "touching edges, narrow gaps, and zero-size geometry",
      bounds: { x: 0, y: 0, width: 12, height: 10 },
      minSize: 0.2,
      layerCount: 3,
      layers: [
        {
          obstacles: [
            { x: 1, y: 1, width: 2, height: 2 },
            { x: 3, y: 1, width: 2, height: 2 },
            { x: 5.00000049, y: 1, width: 2, height: 2 },
            { x: 7.00000151, y: 1, width: 2, height: 2 },
            { x: 0, y: 0.03, width: 12, height: 0 },
            { x: 0.03, y: 0, width: 0, height: 10 },
            { x: 3, y: 3, width: 0, height: 0 },
          ],
        },
        { hard: [{ x: 1, y: 3.03, width: 8, height: 0.01 }] },
        {},
      ],
    },
    {
      name: "long thin rectangles and perpendicular offboard intervals",
      bounds: { x: -1000000, y: -2, width: 2000000, height: 4 },
      minSize: 0.01,
      layerCount: 2,
      layers: [
        {
          obstacles: [
            { x: -2000000, y: -0.2, width: 4000000, height: 0.1 },
            { x: -0.1, y: -1000000, width: 0.2, height: 2000000 },
            { x: 100, y: 1.5, width: 100000, height: 0.00000049 },
            { x: -100000, y: -1.5, width: 100, height: 0.00000151 },
          ],
          hard: [{ x: -500000, y: -1, width: 1000000, height: 0.01 }],
        },
        {},
      ],
    },
    {
      name: "overlapping containing boxes rank by nearest edge rather than box distance",
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      minSize: 0.5,
      layerCount: 3,
      layers: [
        {
          obstacles: [
            { x: -5, y: -5, width: 110, height: 110 },
            { x: 10, y: 10, width: 40, height: 40 },
            { x: 20, y: 20, width: 5, height: 5 },
            { x: 18, y: 18, width: 15, height: 15 },
          ],
          hard: [
            { x: 19, y: 19, width: 7, height: 7 },
            { x: 20, y: 20, width: 5, height: 5 },
          ],
        },
        {
          hard: [
            { x: 45, y: 45, width: 20, height: 20 },
            { x: 40, y: 40, width: 40, height: 40 },
          ],
        },
        {},
      ],
    },
    {
      name: "raw edge distances retain subprecision offsets and duplicate seeds",
      bounds: { x: -2, y: -2, width: 16, height: 14 },
      minSize: 0.000001,
      layerCount: 2,
      layers: [
        {
          obstacles: [
            {
              x: 2.00000049,
              y: 2.00000049,
              width: 4.00000049,
              height: 3.00000049,
            },
            {
              x: 2.00000051,
              y: 2.00000051,
              width: 3.99999951,
              height: 2.99999951,
            },
            {
              x: 6.00000049,
              y: 3.00000051,
              width: 0.00000049,
              height: 0.00000051,
            },
            {
              x: 6.00000049,
              y: 3.00000051,
              width: 0.00000049,
              height: 0.00000051,
            },
          ],
          hard: [
            {
              x: 1.00000049,
              y: 1.00000051,
              width: 8.00000049,
              height: 7.99999951,
            },
            {
              x: 2.00000049,
              y: 2.00000049,
              width: 4.00000049,
              height: 3.00000049,
            },
          ],
        },
        {},
      ],
    },
    {
      name: "large translated coordinates preserve raw ranking distances",
      bounds: { x: 1e12, y: -1e12, width: 8000, height: 6000 },
      minSize: 0.5,
      layerCount: 2,
      layers: [
        {
          obstacles: [
            { x: 1e12 - 1, y: -1e12 - 1, width: 8002, height: 6002 },
            {
              x: 1e12 + 100.00049,
              y: -1e12 + 200.00051,
              width: 2000.00049,
              height: 3000.00051,
            },
            {
              x: 1e12 + 150.00051,
              y: -1e12 + 250.00049,
              width: 100.00051,
              height: 200.00049,
            },
            {
              x: 1e12 + 150.00051,
              y: -1e12 + 250.00049,
              width: 100.00051,
              height: 200.00049,
            },
          ],
          hard: [
            {
              x: 1e12 + 4000.00049,
              y: -1e12 + 3000.00051,
              width: 0,
              height: 1200.00049,
            },
          ],
        },
        {},
      ],
    },
    {
      name: "grouped queries preserve the first accepted float representation",
      bounds: { x: -10, y: -10, width: 20, height: 20 },
      minSize: 0.00000001,
      layerCount: 3,
      layers: [
        {},
        {
          obstacles: [
            {
              x: -3.00000049,
              y: 13,
              width: 3.0000000001,
              height: 0.00000049,
            },
            {
              x: 0.0000000001,
              y: -1.00000049,
              width: 0,
              height: 0.00000051,
            },
          ],
        },
        {},
      ],
    },
    {
      name: "EPS inset dominates a subprecision minimum size",
      bounds: { x: -1, y: -1, width: 2, height: 2 },
      minSize: 0.00000001,
      layerCount: 1,
      layers: [
        {
          obstacles: [
            { x: 0, y: -1, width: 0.00000049, height: 2 },
            { x: -1, y: 0, width: 2, height: 0.00000051 },
          ],
        },
      ],
    },
    ...makeRandomScenarios(),
  ]

  for (const scenario of scenarios) {
    const params = makeParams(scenario)
    expect({
      scenario: scenario.name,
      candidates: computeEdgeCandidates3D(params),
    }).toEqual({
      scenario: scenario.name,
      candidates: computeEdgeCandidates3DReference(params),
    })
  }
})

test("raw ranking includes reversed rectangles beside a containing box", () => {
  for (const rect of [
    { x: 0.2, y: 0, width: -3, height: 1 },
    { x: 0, y: 0.2, width: 1, height: -3 },
    { x: 0.2, y: 0.2, width: -3, height: -3 },
  ]) {
    for (const destination of ["obstacles", "hard"] as const) {
      const params = makeParams({
        name: `reversed ${destination} ranking`,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        minSize: 1,
        layerCount: 2,
        layers: [
          {
            [destination]: [{ x: 0, y: 0, width: 1, height: 1 }, rect],
          },
          {},
        ],
      })
      const result = computeEdgeCandidates3D(params)
      expect(result).toEqual(computeEdgeCandidates3DReference(params))
      const corner = result.find(
        (candidate) =>
          candidate.x === 0.15 && candidate.y === 0.15 && candidate.z === 0,
      )!
      expect(corner.distance).toBeCloseTo(
        rect.width < 0 && rect.height < 0 ? 0.070711 : 0.05,
        6,
      )
    }
  }
})

test("aligned edge queries share one line search and preserve disjoint and reversed intervals", () => {
  const params = makeParams({
    name: "aligned sources with clipped and reversed projections",
    bounds: { x: 0, y: 0, width: 12, height: 10 },
    minSize: 1,
    layerCount: 2,
    layers: [
      {
        obstacles: [
          { x: 5, y: 2, width: 2, height: 2 },
          { x: 5, y: 6, width: 2, height: 2 },
          { x: 5, y: 2, width: 2, height: 2 },
          { x: 4.5, y: 0, width: 1, height: 1 },
          { x: 4.5, y: 9, width: 1, height: 1 },
          { x: 4.5, y: 4, width: 1, height: 1 },
          { x: 4.5, y: 5, width: 1, height: -1 },
        ],
      },
      {},
    ],
  })
  const reference = computeEdgeCandidates3DReference(params)
  const originalSearch = Flatbush.prototype.search
  let sharedLineSearches = 0
  const searchSpy = spyOn(Flatbush.prototype, "search").mockImplementation(
    function (
      this: Flatbush,
      ...args: Parameters<Flatbush["search"]>
    ): number[] {
      if (
        args[0] === 4.85 &&
        args[1] === -Infinity &&
        args[2] === 4.85 &&
        args[3] === Infinity
      ) {
        sharedLineSearches++
      }
      return originalSearch.apply(this, args)
    },
  )
  try {
    expect(computeEdgeCandidates3D(params)).toEqual(reference)
  } finally {
    searchSpy.mockRestore()
  }
  expect(sharedLineSearches).toBe(1)
})
