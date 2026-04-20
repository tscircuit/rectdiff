import {
  mergeGraphics,
  stackGraphicsVertically,
  type GraphicsObject,
} from "graphics-debug"
import rotatedObstacleResolutionSrjJson from "../../test-assets/rotated-obstacle-resolution.json"
import { RectDiffPipeline } from "../RectDiffPipeline"
import type { XYRect } from "../rectdiff-types"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"
import type { SimpleRouteJson } from "../types/srj-types"
import { buildOutlineGraphics } from "../utils/buildOutlineGraphics"
import {
  getObstacleDisplayRect,
  isPointInsideObstacle,
} from "../utils/obstacleGeometry"
import { getColorForZLayer } from "../utils/getColorForZLayer"

export const rotatedObstacleResolutionSrj =
  rotatedObstacleResolutionSrjJson as SimpleRouteJson

export const rotatedObstacleResolutionCases = [
  {
    name: "coarse",
    gridOptions: {
      gridSizes: [2, 1],
      rotatedObstacleGridSize: 1,
    },
  },
  {
    name: "medium",
    gridOptions: {
      gridSizes: [2, 1, 0.5],
      rotatedObstacleGridSize: 0.5,
    },
  },
  {
    name: "fine",
    gridOptions: {
      gridSizes: [2, 1, 0.5, 0.25],
      rotatedObstacleGridSize: 0.25,
    },
  },
] as const

export type RotatedObstacleResolutionCase =
  (typeof rotatedObstacleResolutionCases)[number]

export type RotatedObstacleResolutionMetrics = {
  meshNodeCount: number
  freeNodeCount: number
  obstacleRectCount: number
  missedObstacleArea: number
  freeOverlapArea: number
}

export type RotatedObstacleResolutionPanel = {
  caseConfig: RotatedObstacleResolutionCase
  metrics: RotatedObstacleResolutionMetrics
  graphics: GraphicsObject
}

const SAMPLE_STEP = 0.05

const nodeToRect = (node: CapacityMeshNode): XYRect => ({
  x: node.center.x - node.width / 2,
  y: node.center.y - node.height / 2,
  width: node.width,
  height: node.height,
})

const rectContainsPoint = (rect: XYRect, point: { x: number; y: number }) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height

const buildRotatedObstacleOutlineGraphics = (
  srj: SimpleRouteJson,
): GraphicsObject => ({
  title: "Rotated Obstacles",
  coordinateSystem: "cartesian",
  rects: (srj.obstacles ?? []).flatMap((obstacle) => {
    if (obstacle.type !== "rect") return []
    if (!obstacle.ccwRotationDegrees) return []
    const rect = getObstacleDisplayRect(obstacle)
    if (!rect) return []
    return [
      {
        ...rect,
        fill: "none",
        stroke: "#7f1d1d",
        layer: "rotated-obstacle",
        label: `rotation ${obstacle.ccwRotationDegrees}deg`,
      },
    ]
  }),
})

const computeRotatedObstacleMetrics = (
  srj: SimpleRouteJson,
  meshNodes: CapacityMeshNode[],
): RotatedObstacleResolutionMetrics => {
  const obstacleRects = meshNodes
    .filter((node) => node._containsObstacle)
    .map(nodeToRect)
  const freeRects = meshNodes
    .filter((node) => !node._containsObstacle)
    .map(nodeToRect)
  let missedObstacleSamples = 0
  let freeOverlapSamples = 0

  for (
    let x = srj.bounds.minX + SAMPLE_STEP / 2;
    x < srj.bounds.maxX;
    x += SAMPLE_STEP
  ) {
    for (
      let y = srj.bounds.minY + SAMPLE_STEP / 2;
      y < srj.bounds.maxY;
      y += SAMPLE_STEP
    ) {
      const point = { x, y }
      const insideRotatedObstacle = (srj.obstacles ?? []).some(
        (obstacle) =>
          obstacle.type === "rect" &&
          !!obstacle.ccwRotationDegrees &&
          isPointInsideObstacle(obstacle, point),
      )
      if (!insideRotatedObstacle) continue

      const coveredByObstacleRect = obstacleRects.some((rect) =>
        rectContainsPoint(rect, point),
      )
      const coveredByFreeRect = freeRects.some((rect) =>
        rectContainsPoint(rect, point),
      )

      if (!coveredByObstacleRect) missedObstacleSamples += 1
      if (coveredByFreeRect) freeOverlapSamples += 1
    }
  }

  return {
    meshNodeCount: meshNodes.length,
    freeNodeCount: freeRects.length,
    obstacleRectCount: obstacleRects.length,
    missedObstacleArea: missedObstacleSamples * SAMPLE_STEP * SAMPLE_STEP,
    freeOverlapArea: freeOverlapSamples * SAMPLE_STEP * SAMPLE_STEP,
  }
}

const buildMeshGraphics = (
  srj: SimpleRouteJson,
  caseConfig: RotatedObstacleResolutionCase,
  meshNodes: CapacityMeshNode[],
  metrics: RotatedObstacleResolutionMetrics,
): GraphicsObject => ({
  title: `Rotated obstacle resolution - ${caseConfig.name}`,
  coordinateSystem: "cartesian",
  rects: meshNodes.map((node) => ({
    center: node.center,
    width: node.width,
    height: node.height,
    stroke: node._containsObstacle
      ? "#dc2626"
      : getColorForZLayer(node.availableZ).stroke,
    fill: node._containsObstacle
      ? "rgba(239, 68, 68, 0.35)"
      : getColorForZLayer(node.availableZ).fill,
    layer: node._containsObstacle
      ? "obstacle"
      : `z${node.availableZ.join(",")}`,
    label: node._containsObstacle ? "obstacle rect" : "free rect",
  })),
  texts: [
    {
      anchorSide: "top_right",
      x: srj.bounds.maxX,
      y: srj.bounds.maxY + 0.7,
      fontSize: 0.38,
      text: [
        `${caseConfig.name} step=${caseConfig.gridOptions.rotatedObstacleGridSize}`,
        `obstacle rects=${metrics.obstacleRectCount} free nodes=${metrics.freeNodeCount}`,
        `missed≈${metrics.missedObstacleArea.toFixed(2)} overlap≈${metrics.freeOverlapArea.toFixed(2)}`,
      ].join("\n"),
    },
  ],
})

export const buildRotatedObstacleResolutionPanels =
  (): RotatedObstacleResolutionPanel[] =>
    rotatedObstacleResolutionCases.map((caseConfig) => {
      const srj = structuredClone(rotatedObstacleResolutionSrj)
      const solver = new RectDiffPipeline({
        simpleRouteJson: srj,
        gridOptions: caseConfig.gridOptions,
      })
      solver.solve()

      const meshNodes = solver.getOutput().meshNodes
      const metrics = computeRotatedObstacleMetrics(srj, meshNodes)
      const graphics = mergeGraphics(
        mergeGraphics(
          buildMeshGraphics(srj, caseConfig, meshNodes, metrics),
          buildOutlineGraphics({ srj }),
        ),
        buildRotatedObstacleOutlineGraphics(srj),
      )

      return {
        caseConfig,
        metrics,
        graphics,
      }
    })

export const buildRotatedObstacleResolutionStackedGraphic = (): {
  panels: RotatedObstacleResolutionPanel[]
  graphics: GraphicsObject
} => {
  const panels = buildRotatedObstacleResolutionPanels()
  return {
    panels,
    graphics: stackGraphicsVertically(panels.map((panel) => panel.graphics)),
  }
}
