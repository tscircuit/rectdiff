import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../../types/srj-types"

/**
 * Create basic visualization showing board bounds/outline and obstacles.
 * This can be used before solver initialization to show the problem space.
 */
export function createBaseVisualization(
  srj: SimpleRouteJson,
  title: string = "RectDiff",
): GraphicsObject {
  const rects: NonNullable<GraphicsObject["rects"]> = []
  const lines: NonNullable<GraphicsObject["lines"]> = []

  const boardBounds = {
    minX: srj.bounds.minX,
    maxX: srj.bounds.maxX,
    minY: srj.bounds.minY,
    maxY: srj.bounds.maxY,
  }

  // Draw board outline or bounds rectangle
  if (srj.outline && srj.outline.length > 1) {
    lines.push({
      points: [...srj.outline, srj.outline[0]!],
      strokeColor: "#111827",
      strokeWidth: 0.01,
      label: "outline",
    })
  } else {
    rects.push({
      center: {
        x: (boardBounds.minX + boardBounds.maxX) / 2,
        y: (boardBounds.minY + boardBounds.maxY) / 2,
      },
      width: boardBounds.maxX - boardBounds.minX,
      height: boardBounds.maxY - boardBounds.minY,
      fill: "none",
      stroke: "#111827",
      label: "board",
    })
  }

  // Draw obstacles
  for (const obstacle of srj.obstacles ?? []) {
    if (obstacle.type === "rect" || obstacle.type === "oval") {
      rects.push({
        center: { x: obstacle.center.x, y: obstacle.center.y },
        width: obstacle.width,
        height: obstacle.height,
        fill: "#fee2e2",
        stroke: "#ef4444",
        layer: "obstacle",
        label: "obstacle",
      })
    }
  }

  return {
    title,
    coordinateSystem: "cartesian",
    rects,
    points: [],
    lines,
  }
}
