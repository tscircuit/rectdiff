import { mergeGraphics, type GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { SimpleRouteJson } from "./types/srj-types"
import { getColorForZLayer } from "./utils/getColorForZLayer"
import { buildOutlineGraphics } from "./utils/buildOutlineGraphics"
import { buildObstacleClearanceGraphics } from "./utils/renderObstacleClearance"
import {
  getObstacleDisplayRect,
  isObstacleRotated,
} from "./utils/obstacleGeometry"

type BuildFinalVisualizationParams = {
  srj: SimpleRouteJson
  meshNodes: CapacityMeshNode[]
  obstacleClearance?: number
  rotatedObstacleGridSize?: number
}

export const buildFinalRectDiffVisualization = ({
  srj,
  meshNodes,
  obstacleClearance,
  rotatedObstacleGridSize,
}: BuildFinalVisualizationParams): GraphicsObject => {
  const outline = buildOutlineGraphics({ srj })
  const clearance = buildObstacleClearanceGraphics({
    srj,
    clearance: obstacleClearance,
    rotatedObstacleGridSize,
  })
  const rects = meshNodes.map((node) => ({
    center: node.center,
    width: node.width,
    height: node.height,
    stroke: getColorForZLayer(node.availableZ).stroke,
    fill: node._containsObstacle
      ? "#fca5a5"
      : getColorForZLayer(node.availableZ).fill,
    layer: `z${node.availableZ.join(",")}`,
    label: `node ${node.capacityMeshNodeId}\nz:${node.availableZ.join(",")}`,
  }))

  const nodesGraphic: GraphicsObject = {
    title: "RectDiffPipeline - Final",
    coordinateSystem: "cartesian",
    rects,
    lines: [],
    points: [],
    texts: [],
  }

  const obstacleOutlines: GraphicsObject = {
    title: "Rotated Obstacles",
    coordinateSystem: "cartesian",
    rects: (srj.obstacles ?? []).flatMap((obstacle) => {
      if (obstacle.type !== "rect" || !isObstacleRotated(obstacle)) return []
      const rect = getObstacleDisplayRect(obstacle)
      if (!rect) return []
      return [
        {
          ...rect,
          fill: "none",
          stroke: "#b91c1c",
          layer: "rotated-obstacle",
          label: "rotated obstacle",
        },
      ]
    }),
  }

  return mergeGraphics(
    mergeGraphics(mergeGraphics(nodesGraphic, outline), obstacleOutlines),
    clearance,
  )
}
