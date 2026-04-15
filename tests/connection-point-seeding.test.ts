import { expect, test } from "bun:test"
import RBush from "rbush"
import { buildObstacleIndexesByLayer } from "../lib/solvers/RectDiffGridSolverPipeline/buildObstacleIndexes"
import { computeConnectionCandidates3D } from "../lib/solvers/RectDiffSeedingSolver/computeConnectionCandidates3D"
import type { RTreeRect } from "../lib/types/capacity-mesh-types"
import type { SimpleRouteJson } from "../lib/types/srj-types"

test("computeConnectionCandidates3D seeds around pad-connected ports", () => {
  const srj: SimpleRouteJson = {
    bounds: {
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
    },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 5 },
        width: 0.8,
        height: 1.6,
        connectedTo: ["pad-1"],
      },
    ],
    connections: [
      {
        name: "pad-net",
        pointsToConnect: [
          {
            x: 5,
            y: 5,
            layer: "top",
            pointId: "pcb_port_1",
            pcb_port_id: "pcb_port_1",
          },
          { $ref: "$.connections[0].pointsToConnect[0]" } as any,
        ],
      },
    ],
  }

  const { obstacleIndexByLayer, zIndexByName } = buildObstacleIndexesByLayer({
    srj,
  })

  const candidates = computeConnectionCandidates3D({
    bounds: {
      x: srj.bounds.minX,
      y: srj.bounds.minY,
      width: srj.bounds.maxX - srj.bounds.minX,
      height: srj.bounds.maxY - srj.bounds.minY,
    },
    simpleRouteJson: srj,
    minSize: srj.minTraceWidth * 2,
    layerCount: srj.layerCount,
    obstacleIndexByLayer,
    placedIndexByLayer: Array.from(
      { length: srj.layerCount },
      () => new RBush<RTreeRect>(),
    ),
    hardPlacedByLayer: Array.from({ length: srj.layerCount }, () => []),
    zIndexByName,
  })

  expect(candidates.length).toBeGreaterThanOrEqual(4)

  const xs = candidates.map((candidate) => candidate.x)
  const ys = candidates.map((candidate) => candidate.y)
  const topLayerSeeds = candidates.filter((candidate) => candidate.z === 0)

  expect(topLayerSeeds.length).toBeGreaterThanOrEqual(4)
  expect(xs.some((x) => x < 5)).toBe(true)
  expect(xs.some((x) => x > 5)).toBe(true)
  expect(ys.some((y) => y < 5)).toBe(true)
  expect(ys.some((y) => y > 5)).toBe(true)
})
