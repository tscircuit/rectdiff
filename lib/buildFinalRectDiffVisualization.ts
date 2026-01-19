import { mergeGraphics, type GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { SimpleRouteJson } from "./types/srj-types"
import { getColorForZLayer } from "./utils/getColorForZLayer"
import { buildOutlineGraphics } from "./utils/buildOutlineGraphics"
import { buildObstacleClearanceGraphics } from "./utils/renderObstacleClearance"

type BuildFinalVisualizationParams = {
  srj: SimpleRouteJson
  meshNodes: CapacityMeshNode[]
  obstacleClearance?: number
}

export const buildFinalRectDiffVisualization = ({
  srj,
  meshNodes,
  obstacleClearance,
}: BuildFinalVisualizationParams): GraphicsObject => {
  const outline = buildOutlineGraphics({ srj })
  const clearance = buildObstacleClearanceGraphics({
    srj,
    clearance: obstacleClearance,
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

  return mergeGraphics(mergeGraphics(nodesGraphic, outline), clearance)
}
