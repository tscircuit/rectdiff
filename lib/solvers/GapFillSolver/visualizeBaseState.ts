import type { GraphicsObject } from "graphics-debug"
import type { Placed3D, XYRect } from "../rectdiff/types"

const COLOR_MAP = {
  inputRectFill: "#f3f4f6",
  inputRectStroke: "#9ca3af",
  obstacleRectFill: "#fee2e2",
  obstacleRectStroke: "#fc6e6eff",
}

export function visualizeBaseState(
  inputRects: Placed3D[],
  obstaclesByLayer: XYRect[][],
  title: string = "Gap Fill",
): GraphicsObject {
  const rects: NonNullable<GraphicsObject["rects"]> = []

  for (const placed of inputRects) {
    rects.push({
      center: {
        x: placed.rect.x + placed.rect.width / 2,
        y: placed.rect.y + placed.rect.height / 2,
      },
      width: placed.rect.width,
      height: placed.rect.height,
      fill: COLOR_MAP.inputRectFill,
      stroke: COLOR_MAP.inputRectStroke,
      label: `input rect\npos: (${placed.rect.x.toFixed(2)}, ${placed.rect.y.toFixed(2)})\nsize: ${placed.rect.width.toFixed(2)} × ${placed.rect.height.toFixed(2)}\nz: [${placed.zLayers.join(", ")}]`,
    })
  }

  for (let z = 0; z < obstaclesByLayer.length; z++) {
    const obstacles = obstaclesByLayer[z] ?? []
    for (const obstacle of obstacles) {
      rects.push({
        center: {
          x: obstacle.x + obstacle.width / 2,
          y: obstacle.y + obstacle.height / 2,
        },
        width: obstacle.width,
        height: obstacle.height,
        fill: COLOR_MAP.obstacleRectFill,
        stroke: COLOR_MAP.obstacleRectStroke,
        label: `obstacle\npos: (${obstacle.x.toFixed(2)}, ${obstacle.y.toFixed(2)})\nsize: ${obstacle.width.toFixed(2)} × ${obstacle.height.toFixed(2)}\nz: ${z}`,
      })
    }
  }

  return {
    title,
    coordinateSystem: "cartesian",
    rects,
    points: [],
    lines: [],
  }
}
