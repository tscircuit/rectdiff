import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { ExpandEdgesToEmptySpaceSolver } from "../../../../lib/solvers/GapFillSolver/ExpandEdgesToEmptySpaceSolver"
import type { CapacityMeshNode } from "../../../../lib/types/capacity-mesh-types"

const lowerRegion: CapacityMeshNode = {
  capacityMeshNodeId: "cmn_225",
  center: { x: 20.772797999999998, y: 136.5996595 },
  width: 6.392004,
  height: 4.920137000000011,
  layer: "top",
  availableZ: [0, 1, 2, 3, 4, 5, 6, 7],
}

const upperRegion: CapacityMeshNode = {
  capacityMeshNodeId: "cmn_226",
  center: { x: 20.106765499999998, y: 140.774321 },
  width: 5.059939,
  height: 3.423665999999997,
  layer: "top",
  availableZ: [0, 1, 2, 3, 4, 5, 6, 7],
}

const platedHoleRegion: CapacityMeshNode = {
  capacityMeshNodeId: "cmn_5328",
  center: { x: 23.71173566, y: 140.13472861999998 },
  width: 2.150000779999999,
  height: 2.150000779999999,
  layer: "top",
  availableZ: [0, 1, 2, 3, 4, 5, 6, 7],
  _containsObstacle: true,
  _containsTarget: true,
}

test("PMP22650 does not fill a gap narrower than minTraceWidth", async () => {
  const solver = new ExpandEdgesToEmptySpaceSolver({
    inputMeshNodes: [lowerRegion, upperRegion, platedHoleRegion],
    segmentsWithAdjacentEmptySpace: [
      {
        parent: lowerRegion,
        start: { x: 17.576795999999998, y: 139.059728 },
        end: { x: 22.63673527, y: 139.059728 },
        z: 7,
        facingDirection: "y+",
      },
    ],
  })

  solver.solve()

  const expandedNodes = solver
    .getOutput()
    .expandedSegments.map(({ newNode }) => newNode)
  expect(expandedNodes).toHaveLength(1)
  expect(expandedNodes[0]).toMatchObject({
    width: 5.059939270000001,
    height: 0.002759999999966567,
  })
  const verticalScale = 40
  await expect(
    getSvgFromGraphicsObject(
      {
        title:
          "PMP22650 gap fill compared with minTraceWidth (40× vertical scale)",
        coordinateSystem: "cartesian",
        rects: [
          {
            center: { x: 0, y: 0 },
            width: 5.059939270000001,
            height: 0.1 * verticalScale,
            fill: "rgba(239, 68, 68, 0.12)",
            stroke: "#dc2626",
            label: "0.1 mm minimum-width trace envelope",
          },
          ...expandedNodes.map((node) => ({
            center: { x: 0, y: 0 },
            width: node.width,
            height: node.height * verticalScale,
            fill: "#22c55e",
            stroke: "#15803d",
            label: `${node.width.toFixed(5)} mm × ${node.height.toFixed(5)} mm generated gap fill`,
          })),
        ],
        texts: [
          {
            x: 0,
            y: 2.35,
            text: `${expandedNodes.length} unroutable gap-fill node generated (40× vertical scale)`,
            fontSize: 0.18,
            anchorSide: "bottom_center",
          },
        ],
      },
      {
        width: 1200,
        height: 300,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
