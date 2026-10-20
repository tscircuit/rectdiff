import { expect, spyOn, test } from "bun:test"
import Flatbush from "flatbush"
import { getSvgFromGraphicsObject } from "graphics-debug"
import type { Candidate3D, XYRect } from "../lib/rectdiff-types"
import { computeEdgeCandidates3D } from "../lib/solvers/RectDiffSeedingSolver/computeEdgeCandidates3D"
import { computeEdgeCandidates3DReference } from "./fixtures/computeEdgeCandidates3DReference"
import {
  makeQueryWorkComparisonGraphics,
  makeQueryWorkSnapshotParams,
  queryX,
} from "./fixtures/indexedEdgeQuerySnapshot"

test("indexed edge query returns two blockers while preserving the exhaustive seeds", async (): Promise<void> => {
  const params = makeQueryWorkSnapshotParams()
  const sourceBlockers: XYRect[] = params.obstacleIndexByLayer[0]!.all().map(
    (rect) => ({
      x: rect.minX,
      y: rect.minY,
      width: rect.maxX - rect.minX,
      height: rect.maxY - rect.minY,
    }),
  )
  const reference = computeEdgeCandidates3DReference(params)
  const capturedSearches: number[][] = []
  const originalSearch = Flatbush.prototype.search
  const searchSpy = spyOn(Flatbush.prototype, "search").mockImplementation(
    function (
      this: Flatbush,
      ...args: Parameters<Flatbush["search"]>
    ): number[] {
      const indices = originalSearch.apply(this, args)
      if (
        args[0] === queryX &&
        args[1] === -Infinity &&
        args[2] === queryX &&
        args[3] === Infinity
      ) {
        capturedSearches.push([...indices])
      }
      return indices
    },
  )
  let indexed: Candidate3D[]
  try {
    indexed = computeEdgeCandidates3D(params)
  } finally {
    searchSpy.mockRestore()
  }

  expect(indexed).toEqual(reference)
  expect(sourceBlockers).toHaveLength(12)
  expect(capturedSearches).toHaveLength(1)
  const queriedBlockers = capturedSearches[0]!.map(
    (index) => sourceBlockers[index]!,
  )
  expect(queriedBlockers).toHaveLength(2)
  expect([...queriedBlockers].sort((left, right) => left.y - right.y)).toEqual([
    { x: 4.5, y: 3, width: 1, height: 1 },
    { x: 4.5, y: 6, width: 1, height: 1 },
  ])

  const referenceSeeds = reference.filter((candidate) => candidate.x === queryX)
  const indexedSeeds = indexed.filter((candidate) => candidate.x === queryX)
  expect(indexedSeeds).toEqual(referenceSeeds)
  expect(indexedSeeds.map(({ x, y, z }) => ({ x, y, z }))).toEqual([
    { x: queryX, y: 2.5, z: 0 },
    { x: queryX, y: 5, z: 0 },
    { x: queryX, y: 7.5, z: 0 },
  ])
  expect(
    indexedSeeds.some((seed) =>
      queriedBlockers.some(
        (blocker) =>
          seed.y >= blocker.y && seed.y <= blocker.y + blocker.height,
      ),
    ),
  ).toBe(false)

  const svg = getSvgFromGraphicsObject(
    makeQueryWorkComparisonGraphics({
      reference: referenceSeeds,
      indexed: indexedSeeds,
      queriedBlockers,
    }),
    { backgroundColor: "white", svgWidth: 1600, svgHeight: 1000 },
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
