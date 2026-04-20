import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import { getApproximateObstacleRects } from "./obstacleGeometry"

/**
 * Pure helper that returns clearance rect graphics; does not mutate inputs.
 */
export const buildObstacleClearanceGraphics = (params: {
  srj: SimpleRouteJson
  clearance: number | undefined
  rotatedObstacleGridSize?: number
}): GraphicsObject => {
  const { srj, clearance, rotatedObstacleGridSize } = params
  const c = clearance ?? 0
  if (c <= 0) {
    return {
      title: "Obstacle Clearance",
      coordinateSystem: "cartesian",
      rects: [],
    }
  }

  const rects: NonNullable<GraphicsObject["rects"]> = []

  for (const obstacle of srj.obstacles ?? []) {
    if (obstacle.type !== "rect") continue
    for (const rect of getApproximateObstacleRects(obstacle, {
      rotatedObstacleGridSize,
    })) {
      const expanded = {
        x: rect.x - c,
        y: rect.y - c,
        width: rect.width + 2 * c,
        height: rect.height + 2 * c,
      }
      rects.push({
        center: {
          x: expanded.x + expanded.width / 2,
          y: expanded.y + expanded.height / 2,
        },
        width: expanded.width,
        height: expanded.height,
        stroke: "rgba(202, 138, 4, 0.9)",
        fill: "rgba(234, 179, 8, 0.15)",
        layer: "obstacle-clearance",
        label: `clearance\nz:${(obstacle.zLayers ?? []).join(",") || "all"}`,
      })
    }
  }

  return {
    title: "Obstacle Clearance",
    coordinateSystem: "cartesian",
    rects,
  }
}
