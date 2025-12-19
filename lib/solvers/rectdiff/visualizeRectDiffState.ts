import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { RectDiffState } from "./types"
import { overlaps } from "./geometry"
import { getColorForZLayer } from "./visualizationColors"

export function visualizeRectDiffState(
  rectDiffState: RectDiffState | undefined,
  simpleRouteJson: SimpleRouteJson,
): GraphicsObject {
  const rectList: NonNullable<GraphicsObject["rects"]> = []
  const pointList: NonNullable<GraphicsObject["points"]> = []
  const lineList: NonNullable<GraphicsObject["lines"]> = []

  const boardBounds = {
    minX: simpleRouteJson.bounds.minX,
    maxX: simpleRouteJson.bounds.maxX,
    minY: simpleRouteJson.bounds.minY,
    maxY: simpleRouteJson.bounds.maxY,
  }

  if (simpleRouteJson.outline && simpleRouteJson.outline.length > 1) {
    lineList.push({
      points: [...simpleRouteJson.outline, simpleRouteJson.outline[0]!],
      strokeColor: "#111827",
      strokeWidth: 0.01,
      label: "outline",
    })
  } else {
    rectList.push({
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

  for (const obstacle of simpleRouteJson.obstacles ?? []) {
    if (obstacle.type === "rect" || obstacle.type === "oval") {
      rectList.push({
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

  if (rectDiffState?.boardVoidRects) {
    let outlineBoundingRect: {
      x: number
      y: number
      width: number
      height: number
    } | null = null

    if (simpleRouteJson.outline && simpleRouteJson.outline.length > 0) {
      const xCoordinateList = simpleRouteJson.outline.map(
        (outlinePoint) => outlinePoint.x,
      )
      const yCoordinateList = simpleRouteJson.outline.map(
        (outlinePoint) => outlinePoint.y,
      )
      const minX = Math.min(...xCoordinateList)
      const minY = Math.min(...yCoordinateList)
      outlineBoundingRect = {
        x: minX,
        y: minY,
        width: Math.max(...xCoordinateList) - minX,
        height: Math.max(...yCoordinateList) - minY,
      }
    }

    for (const voidRect of rectDiffState.boardVoidRects) {
      if (outlineBoundingRect && !overlaps(voidRect, outlineBoundingRect)) {
        continue
      }

      rectList.push({
        center: {
          x: voidRect.x + voidRect.width / 2,
          y: voidRect.y + voidRect.height / 2,
        },
        width: voidRect.width,
        height: voidRect.height,
        fill: "rgba(0, 0, 0, 0.5)",
        stroke: "none",
        label: "void",
      })
    }
  }

  if (rectDiffState?.candidates?.length) {
    for (const candidate of rectDiffState.candidates) {
      pointList.push({
        x: candidate.x,
        y: candidate.y,
        label: `z:${candidate.z}`,
      })
    }
  }

  if (rectDiffState?.placed?.length) {
    for (const placedRect of rectDiffState.placed) {
      const colorStyle = getColorForZLayer(placedRect.zLayers)
      rectList.push({
        center: {
          x: placedRect.rect.x + placedRect.rect.width / 2,
          y: placedRect.rect.y + placedRect.rect.height / 2,
        },
        width: placedRect.rect.width,
        height: placedRect.rect.height,
        fill: colorStyle.fill,
        stroke: colorStyle.stroke,
        label: `free\nz:${placedRect.zLayers.join(",")}`,
      })
    }
  }

  return {
    title: "RectDiff",
    coordinateSystem: "cartesian",
    rects: rectList,
    points: pointList,
    lines: lineList,
  }
}
