import type { GraphicsObject } from "graphics-debug"
import type { Placed3D, Rect3d } from "lib/rectdiff-types"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"
import type { ActiveRect } from "./shared"
import { maskToZLayers } from "./shared"

export function addSourcePlacements(
  rects: NonNullable<GraphicsObject["rects"]>,
  placed: Placed3D[],
) {
  for (const placement of placed) {
    rects.push({
      center: {
        x: placement.rect.x + placement.rect.width / 2,
        y: placement.rect.y + placement.rect.height / 2,
      },
      width: placement.rect.width,
      height: placement.rect.height,
      fill: "rgba(148, 163, 184, 0.08)",
      stroke: "rgba(100, 116, 139, 0.3)",
      label: `src\nz:${placement.zLayers.join(",")}`,
    })
  }
}

export function addGridLines(
  lines: NonNullable<GraphicsObject["lines"]>,
  xs: number[],
  ys: number[],
) {
  for (const x of xs) {
    lines.push({
      points: [
        { x, y: ys[0] ?? 0 },
        { x, y: ys[ys.length - 1] ?? 0 },
      ],
      strokeColor: "rgba(148, 163, 184, 0.25)",
      strokeDash: "3 3",
    })
  }
  for (const y of ys) {
    lines.push({
      points: [
        { x: xs[0] ?? 0, y },
        { x: xs[xs.length - 1] ?? 0, y },
      ],
      strokeColor: "rgba(148, 163, 184, 0.25)",
      strokeDash: "3 3",
    })
  }
}

export function addRect3dOverlays(
  rects: NonNullable<GraphicsObject["rects"]>,
  rect3ds: Rect3d[],
  prefix: string,
) {
  for (const rect of rect3ds) {
    const colors = getColorForZLayer(rect.zLayers)
    rects.push({
      center: {
        x: (rect.minX + rect.maxX) / 2,
        y: (rect.minY + rect.maxY) / 2,
      },
      width: rect.maxX - rect.minX,
      height: rect.maxY - rect.minY,
      fill: rect.isObstacle ? "rgba(239, 68, 68, 0.25)" : colors.fill,
      stroke: rect.isObstacle ? "rgba(220, 38, 38, 0.95)" : colors.stroke,
      layer: `z${rect.zLayers.join(",")}`,
      label: `${prefix}\nz:${rect.zLayers.join(",")}`,
    })
  }
}

export function addActiveRects(
  rects: NonNullable<GraphicsObject["rects"]>,
  activeRects: ActiveRect[],
  layerCount: number,
) {
  for (const rect of activeRects) {
    const zLayers = maskToZLayers(rect.mask, layerCount)
    const colors = getColorForZLayer(zLayers)
    rects.push({
      center: {
        x: (rect.minX + rect.maxX) / 2,
        y: (rect.minY + rect.maxY) / 2,
      },
      width: rect.maxX - rect.minX,
      height: rect.maxY - rect.minY,
      fill: "rgba(0,0,0,0)",
      stroke: colors.stroke,
      strokeDash: "5 3",
      label: `active\nz:${zLayers.join(",")}`,
    })
  }
}

export function addInfoText(
  texts: NonNullable<GraphicsObject["texts"]>,
  xs: number[],
  ys: number[],
  info: string,
) {
  texts.push({
    x: xs[0] ?? 0,
    y: ys[0] ?? 0,
    text: info,
    anchorSide: "top_left",
    fontSize: 0.9,
  })
}
