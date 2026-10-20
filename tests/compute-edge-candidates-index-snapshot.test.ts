import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { computeEdgeCandidates3D } from "../lib/solvers/RectDiffSeedingSolver/computeEdgeCandidates3D"
import { containsPoint } from "../lib/utils/rectdiff-geometry"
import { computeEdgeCandidates3DReference } from "./fixtures/computeEdgeCandidates3DReference"
import {
  edgeCandidateObstaclesByLayer,
  makeEdgeCandidateComparisonGraphics,
  makeEdgeCandidateSnapshotParams,
} from "./fixtures/indexedEdgeCandidateSnapshot"

test("indexed edge queries preserve seed geometry, raw ranking and deduplication", async (): Promise<void> => {
  const params = makeEdgeCandidateSnapshotParams(edgeCandidateObstaclesByLayer)
  const reference = computeEdgeCandidates3DReference(params)
  const indexed = computeEdgeCandidates3D(params)

  // This is a performance fix: the indexed and exhaustive drawings must match,
  // including candidate order and layer spans, rather than changing the mesh.
  expect(indexed).toEqual(reference)
  expect(indexed.filter((candidate) => candidate.z === 0)).toHaveLength(4)
  expect(indexed.filter((candidate) => candidate.z === 1)).toHaveLength(20)

  // Both rectangles contain this corner. Box distance would incorrectly rank
  // it as zero; using rounded line geometry would give 0.099999, not 0.100000.
  const corner = indexed.find(
    (candidate) =>
      candidate.z === 0 && candidate.x === 0.15 && candidate.y === 0.15,
  )!
  expect(corner.distance).toBeCloseTo(0.1, 12)
  expect(corner.zSpanLen).toBe(2)

  // The center is occupied on every layer, so it contributes no candidates.
  const centerBlocker = edgeCandidateObstaclesByLayer[1]![0]!
  expect(
    indexed.some((candidate) => containsPoint(centerBlocker, candidate)),
  ).toBe(false)
  const edgeSeeds = indexed
    .filter(
      (candidate) =>
        candidate.z === 1 &&
        candidate.x > 0.5 &&
        candidate.x < 1.5 &&
        candidate.y > 0.5 &&
        candidate.y < 1.5,
    )
    .map((candidate) => `${candidate.x.toFixed(2)},${candidate.y.toFixed(2)}`)
  expect(edgeSeeds.sort()).toEqual([
    "0.65,1.00",
    "1.00,0.65",
    "1.00,1.35",
    "1.35,1.00",
  ])
  expect(
    new Set(
      indexed.map(
        (candidate) => `${candidate.z}|${candidate.x}|${candidate.y}`,
      ),
    ).size,
  ).toBe(indexed.length)
  expect(indexed).toEqual(
    computeEdgeCandidates3D(
      makeEdgeCandidateSnapshotParams([
        edgeCandidateObstaclesByLayer[0]!,
        [centerBlocker],
      ]),
    ),
  )

  const svg = getSvgFromGraphicsObject(
    makeEdgeCandidateComparisonGraphics(reference, indexed),
    { backgroundColor: "white", svgWidth: 1200, svgHeight: 1200 },
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
