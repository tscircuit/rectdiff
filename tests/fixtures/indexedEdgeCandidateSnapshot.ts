import { createGraphicsGrid, type GraphicsObject } from "graphics-debug"
import RBush from "rbush"
import type { Candidate3D, XYRect } from "../../lib/rectdiff-types"
import type { computeEdgeCandidates3D } from "../../lib/solvers/RectDiffSeedingSolver/computeEdgeCandidates3D"
import type { RTreeRect } from "../../lib/types/capacity-mesh-types"
import { rectToTree } from "../../lib/utils/rectToTree"

const bounds: XYRect = { x: 0, y: 0, width: 2, height: 2 }
const centerBlocker: XYRect = { x: 0.8, y: 0.8, width: 0.4, height: 0.4 }

export const edgeCandidateObstaclesByLayer: XYRect[][] = [
  [
    { x: -1, y: -1, width: 4, height: 4 },
    { x: 0.05000049, y: 0.05, width: 0.19999949, height: 0.2 },
  ],
  [centerBlocker, { ...centerBlocker }],
]

export function makeEdgeCandidateSnapshotParams(
  obstaclesByLayer: XYRect[][],
): Parameters<typeof computeEdgeCandidates3D>[0] {
  return {
    bounds,
    minSize: 1,
    layerCount: obstaclesByLayer.length,
    obstacleIndexByLayer: obstaclesByLayer.map((rects, z) =>
      new RBush<RTreeRect>().load(
        rects.map((rect) => rectToTree(rect, { zLayers: [z] })),
      ),
    ),
    placedIndexByLayer: obstaclesByLayer.map(() => new RBush<RTreeRect>()),
    hardPlacedByLayer: obstaclesByLayer.map(() => []),
  }
}

export function makeEdgeCandidateComparisonGraphics(
  reference: Candidate3D[],
  indexed: Candidate3D[],
): GraphicsObject {
  function panel({
    candidates,
    title,
    z,
  }: {
    candidates: Candidate3D[]
    title: string
    z: number
  }): GraphicsObject {
    const onLayer = candidates.filter((candidate) => candidate.z === z)
    const corner = onLayer.find(
      (candidate) => candidate.x === 0.15 && candidate.y === 0.15,
    )!
    return {
      rects: [
        // Equal viewports keep the containing rectangle visible on both rows.
        {
          center: { x: 1, y: 1 },
          width: 4,
          height: 5.6,
          fill: "none",
          stroke: "none",
        },
        ...edgeCandidateObstaclesByLayer[z]!.map((rect) => ({
          center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          width: rect.width,
          height: rect.height,
          fill: "rgba(239,68,68,0.12)",
          stroke: "#dc2626",
        })),
        {
          center: { x: 1, y: 1 },
          width: bounds.width,
          height: bounds.height,
          fill: "none",
          stroke: "#475569",
        },
      ],
      circles: onLayer.map((candidate) => ({
        center: { x: candidate.x, y: candidate.y },
        radius: 0.035,
        fill: "#2563eb",
      })),
      texts: [
        { x: 1, y: 3.5, text: `${title} / z${z}`, fontSize: 0.18 },
        {
          x: 1,
          y: 3.2,
          text: `${onLayer.length} seeds; same positions and ordering`,
          fontSize: 0.12,
        },
        {
          x: 1,
          y: -1.3,
          text:
            z === 0
              ? `Corner ranking distance: ${corner.distance.toFixed(6)}`
              : "Duplicate blockers: four unique edge seeds",
          fontSize: 0.12,
        },
      ],
      lines:
        z === 0
          ? [
              {
                points: [
                  { x: 0.15, y: -0.7 },
                  { x: corner.x, y: corner.y },
                ],
                strokeColor: "#15803d",
                strokeWidth: 0.015,
              },
            ]
          : [],
    }
  }

  return {
    ...createGraphicsGrid(
      [0, 1].map((z) => [
        panel({ candidates: reference, title: "Exhaustive reference", z }),
        panel({ candidates: indexed, title: "Indexed queries", z }),
      ]),
      { cellWidth: 4, cellHeight: 5.6, gap: 0.4 },
    ),
    coordinateSystem: "cartesian",
  }
}
