import type { SimpleRouteJson } from "lib/types/srj-types"
import type { GraphicsObject } from "graphics-debug"

/**
 * Pure helper that returns clearance rect graphics; does not mutate inputs.
 */
export const buildObstacleClearanceGraphics = (params: {
  srj: SimpleRouteJson
  clearance: number | undefined
}): GraphicsObject => {
  const { srj, clearance } = params
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
    if (obstacle.type !== "rect" && obstacle.type !== "oval") continue
    const expanded = {
      x: obstacle.center.x - obstacle.width / 2 - c,
      y: obstacle.center.y - obstacle.height / 2 - c,
      width: obstacle.width + 2 * c,
      height: obstacle.height + 2 * c,
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

  return {
    title: "Obstacle Clearance",
    coordinateSystem: "cartesian",
    rects,
  }
}
