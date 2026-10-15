import { expect, test } from "bun:test"
import { sample024 } from "@tscircuit/dataset-srj24"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
  type GraphicsObject,
  type Rect,
} from "graphics-debug"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { Obstacle } from "lib/types/srj-types"

const localBounds = {
  minX: 156.8,
  maxX: 160.4,
  minY: 123.9,
  maxY: 127.6,
}
const originalAltiumVia = { x: 159.01079958, y: 126.15159936 }
const topTerminal = { x: 158.37579958, y: 125.98959816 }
const bottomTerminal = { x: 159.22980092, y: 125.64359936 }

const clipRectToLocalBounds = (rect: Rect): Rect | null => {
  const minX = Math.max(localBounds.minX, rect.center.x - rect.width / 2)
  const maxX = Math.min(localBounds.maxX, rect.center.x + rect.width / 2)
  const minY = Math.max(localBounds.minY, rect.center.y - rect.height / 2)
  const maxY = Math.min(localBounds.maxY, rect.center.y + rect.height / 2)
  if (minX >= maxX || minY >= maxY) return null

  return {
    ...rect,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: maxX - minX,
    height: maxY - minY,
  }
}

const getLocalMeshRects = (
  meshNodes: CapacityMeshNode[],
  includeNode: (node: CapacityMeshNode) => boolean,
): Rect[] =>
  meshNodes.flatMap((node) => {
    if (!includeNode(node)) return []
    const rect = clipRectToLocalBounds({
      center: node.center,
      width: node.width,
      height: node.height,
      stroke:
        node.availableZ.includes(0) && node.availableZ.includes(7)
          ? "#15803d"
          : "#334155",
      fill:
        node.availableZ.includes(0) && node.availableZ.includes(7)
          ? "rgba(34, 197, 94, 0.55)"
          : "rgba(148, 163, 184, 0.18)",
      label: `${node.capacityMeshNodeId} z:${node.availableZ.join(",")}`,
    })
    return rect ? [rect] : []
  })

const getLocalObstacleRects = (
  obstacles: Obstacle[],
  layer: "top" | "bottom",
): Rect[] =>
  obstacles.flatMap((obstacle) => {
    if (!obstacle.layers.includes(layer)) return []
    const rect = clipRectToLocalBounds({
      center: obstacle.center,
      width: obstacle.width,
      height: obstacle.height,
      stroke: layer === "top" ? "#dc2626" : "#2563eb",
      fill:
        layer === "top" ? "rgba(239, 68, 68, 0.28)" : "rgba(37, 99, 235, 0.28)",
      label: `${layer} obstacle`,
    })
    return rect ? [rect] : []
  })

const createLocalPanel = (params: {
  title: string
  rects: Rect[]
}): GraphicsObject => ({
  title: params.title,
  coordinateSystem: "cartesian",
  rects: [
    {
      center: {
        x: (localBounds.minX + localBounds.maxX) / 2,
        y: (localBounds.minY + localBounds.maxY) / 2,
      },
      width: localBounds.maxX - localBounds.minX,
      height: localBounds.maxY - localBounds.minY,
      fill: "#ffffff",
      stroke: "#0f172a",
    },
    ...params.rects,
  ],
  points: [
    {
      ...topTerminal,
      color: "#dc2626",
      label: "C241.1 top",
    },
    {
      ...bottomTerminal,
      color: "#2563eb",
      label: "R188.2 bottom",
    },
    {
      ...originalAltiumVia,
      color: "#a21caf",
      label: "original Altium via",
    },
  ],
  lines: [],
  texts: [
    {
      x: (localBounds.minX + localBounds.maxX) / 2,
      y: localBounds.maxY - 0.12,
      text: params.title,
      fontSize: 0.18,
      anchorSide: "top_center",
    },
  ],
})

test("PMP22650 has a local top-to-bottom routing region near C241 and R188", async () => {
  const solver = new RectDiffPipeline({
    simpleRouteJson: sample024,
    maxGapFillPasses: 1,
  })
  solver.solve()

  const { meshNodes } = solver.getOutput()
  const topBottomNodes = meshNodes.filter(
    (node) => node.availableZ.includes(0) && node.availableZ.includes(7),
  )
  const closestTopBottomTransitionDistance = Math.min(
    ...topBottomNodes.map((node) =>
      Math.hypot(
        node.center.x - originalAltiumVia.x,
        node.center.y - originalAltiumVia.y,
      ),
    ),
  )

  expect(closestTopBottomTransitionDistance).toBeLessThan(1.5)

  const topObstacles = getLocalObstacleRects(sample024.obstacles, "top")
  const bottomObstacles = getLocalObstacleRects(sample024.obstacles, "bottom")
  const graphics = stackGraphicsHorizontally([
    createLocalPanel({
      title: "PMP22650 top-layer topology",
      rects: [
        ...getLocalMeshRects(meshNodes, (node) => node.availableZ.includes(0)),
        ...topObstacles,
      ],
    }),
    createLocalPanel({
      title: "PMP22650 bottom-layer topology",
      rects: [
        ...getLocalMeshRects(meshNodes, (node) => node.availableZ.includes(7)),
        ...bottomObstacles,
      ],
    }),
    createLocalPanel({
      title: "PMP22650 top-to-bottom transition regions",
      rects: [
        ...topObstacles,
        ...bottomObstacles,
        ...getLocalMeshRects(
          meshNodes,
          (node) => node.availableZ.includes(0) && node.availableZ.includes(7),
        ),
      ],
    }),
  ])
  const svg = getSvgFromGraphicsObject(graphics, {
    svgWidth: 1500,
    svgHeight: 600,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
