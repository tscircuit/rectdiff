import { createGraphicsGrid, type GraphicsObject } from "graphics-debug"
import RBush from "rbush"
import type { Candidate3D, XYRect } from "../../lib/rectdiff-types"
import type { computeEdgeCandidates3D } from "../../lib/solvers/RectDiffSeedingSolver/computeEdgeCandidates3D"
import type { RTreeRect } from "../../lib/types/capacity-mesh-types"
import { rectToTree } from "../../lib/utils/rectToTree"

export const queryX = 4.85 // Left edge of the source obstacle minus the 0.15 inset.
const bounds: XYRect = { x: 0, y: 0, width: 12, height: 10 }
const source: XYRect = { x: 5, y: 2, width: 2, height: 6 }
const obstacles: XYRect[] = [
  source,
  { x: 4.5, y: 3, width: 1, height: 1 },
  { x: 4.5, y: 6, width: 1, height: 1 },
  { x: 0.6, y: 0.6, width: 1, height: 0.7 },
  { x: 0.6, y: 3.8, width: 1, height: 0.8 },
  { x: 0.6, y: 7.5, width: 1, height: 0.8 },
  { x: 2.5, y: 1.2, width: 0.8, height: 0.8 },
  { x: 2.5, y: 5, width: 0.8, height: 0.8 },
  { x: 2.5, y: 8.2, width: 0.8, height: 0.8 },
  { x: 9, y: 0.8, width: 1, height: 0.8 },
  { x: 9, y: 4.5, width: 1, height: 0.8 },
  { x: 9, y: 8, width: 1, height: 0.8 },
]

export function makeQueryWorkSnapshotParams(): Parameters<
  typeof computeEdgeCandidates3D
>[0] {
  return {
    bounds,
    minSize: 1,
    layerCount: 1,
    obstacleIndexByLayer: [
      new RBush<RTreeRect>().load(
        obstacles.map((rect) => rectToTree(rect, { zLayers: [0] })),
      ),
    ],
    placedIndexByLayer: [new RBush<RTreeRect>()],
    hardPlacedByLayer: [[]],
  }
}

export function makeQueryWorkComparisonGraphics({
  reference,
  indexed,
  queriedBlockers,
}: {
  reference: Candidate3D[]
  indexed: Candidate3D[]
  queriedBlockers: XYRect[]
}): GraphicsObject {
  function panel(candidates: Candidate3D[], useIndex: boolean): GraphicsObject {
    const seeds = candidates.filter(
      (candidate) =>
        candidate.z === 0 &&
        Math.abs(candidate.x - queryX) < 1e-9 &&
        candidate.y >= source.y &&
        candidate.y <= source.y + source.height,
    )
    const checked = useIndex ? queriedBlockers : obstacles
    const isChecked = (rect: XYRect) =>
      checked.some(
        (other) =>
          Math.abs(rect.x - other.x) < 1e-9 &&
          Math.abs(rect.y - other.y) < 1e-9 &&
          Math.abs(rect.width - other.width) < 1e-9 &&
          Math.abs(rect.height - other.height) < 1e-9,
      )

    return {
      rects: [
        // An equal viewport keeps both columns at the same scale.
        {
          center: { x: 6, y: 5 },
          width: 14,
          height: 16,
          fill: "none",
          stroke: "none",
        },
        {
          center: { x: 6, y: 5 },
          width: bounds.width,
          height: bounds.height,
          fill: "none",
          stroke: "#94a3b8",
        },
        ...obstacles.map((rect) => ({
          center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          width: rect.width,
          height: rect.height,
          fill: isChecked(rect) ? "#fed7aa" : "#e2e8f0",
          stroke: isChecked(rect) ? "#c2410c" : "#cbd5e1",
        })),
      ],
      lines: [
        {
          points: [
            { x: 0, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0 },
          ],
          strokeColor: "#94a3b8",
          strokeWidth: 0.025,
        },
        {
          points: [
            { x: queryX, y: 0 },
            { x: queryX, y: 10 },
          ],
          strokeColor: "#7c3aed",
          strokeWidth: 0.035,
          strokeDash: "6 6",
        },
        // The expected gaps are checked against actual production seed output
        // in the test. No other edge's candidates are drawn in this close-up.
        ...[
          [2, 3],
          [4, 6],
          [7, 8],
        ].map(([start, end]) => ({
          points: [
            { x: queryX, y: start! },
            { x: queryX, y: end! },
          ],
          strokeColor: "#16a34a",
          strokeWidth: 0.12,
        })),
        ...queriedBlockers.map((rect) => ({
          points: [
            { x: queryX, y: rect.y },
            { x: queryX, y: rect.y + rect.height },
          ],
          strokeColor: "#c2410c",
          strokeWidth: 0.12,
        })),
      ],
      circles: seeds.map((seed) => ({
        center: { x: seed.x, y: seed.y },
        radius: 0.13,
        fill: "#1d4ed8",
        stroke: "#ffffff",
      })),
      texts: [
        {
          x: 6,
          y: 12.3,
          text: useIndex
            ? "AFTER: query the spatial index"
            : "BEFORE: scan every rectangle",
          fontSize: 0.48,
        },
        {
          x: 6,
          y: 11.55,
          text: `${checked.length} rectangles checked for this line`,
          fontSize: 0.4,
          color: "#c2410c",
        },
        {
          x: 6,
          y: 10.7,
          text: "One obstacle-edge query at x = 4.85",
          fontSize: 0.31,
          color: "#6d28d9",
        },
        { x: 6.25, y: 5.25, text: "source", fontSize: 0.28 },
        { x: 6.25, y: 4.8, text: "obstacle", fontSize: 0.28 },
        {
          x: 6,
          y: -0.65,
          text: "Orange: checked     Gray: skipped",
          fontSize: 0.34,
        },
        {
          x: 6,
          y: -1.3,
          text: "Green: free gaps     Blue: seed points",
          fontSize: 0.34,
        },
        {
          x: 6,
          y: -2.2,
          text: `Same ${seeds.length} seeds on this edge`,
          fontSize: 0.43,
          color: "#1d4ed8",
        },
        {
          x: 6,
          y: -2.8,
          text: useIndex
            ? "Index built once, reused for every edge"
            : "Every edge repeats the full scan",
          fontSize: 0.28,
        },
      ],
    }
  }

  return {
    ...createGraphicsGrid([[panel(reference, false), panel(indexed, true)]], {
      cellWidth: 14,
      cellHeight: 16,
      gap: 0.8,
    }),
    coordinateSystem: "cartesian",
  }
}
