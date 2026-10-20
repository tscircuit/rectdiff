import { getSvgFromGraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import type { XYRect } from "../../lib/rectdiff-types"
import { EPS } from "../../lib/utils/rectdiff-geometry"
import board109Outline from "../../test-assets/board109-outline.json"

/** Show every void rectangle intersecting a small section of the circular edge. */
export function getBoard109OutlineSnapshot(rects: XYRect[]): string {
  const detailBounds = { minX: 20, minY: 20, maxX: 23, maxY: 23 }
  const detailRects = rects
    .filter(
      (rect) =>
        rect.x <= detailBounds.maxX &&
        rect.x + rect.width >= detailBounds.minX &&
        rect.y <= detailBounds.maxY &&
        rect.y + rect.height >= detailBounds.minY,
    )
    .map((rect) => {
      const minX = Math.max(detailBounds.minX, rect.x)
      const maxX = Math.min(detailBounds.maxX, rect.x + rect.width)
      const minY = Math.max(detailBounds.minY, rect.y)
      const maxY = Math.min(detailBounds.maxY, rect.y + rect.height)
      return {
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        width: maxX - minX,
        height: maxY - minY,
        fill: "#fee2e2",
        stroke: "#f97316",
        label: `void: ${rect.width.toExponential(2)} x ${rect.height.toExponential(2)} mm`,
      }
    })
  const sliverCount = rects.filter(
    (rect) => rect.width <= EPS || rect.height <= EPS,
  ).length

  return getSvgFromGraphicsObject(
    {
      coordinateSystem: "cartesian",
      rects: detailRects,
      lines: [
        ...detailRects.map((rect) => ({
          points: [
            {
              x: rect.center.x - rect.width / 2,
              y: rect.center.y - rect.height / 2,
            },
            {
              x: rect.center.x + rect.width / 2,
              y: rect.center.y - rect.height / 2,
            },
            {
              x: rect.center.x + rect.width / 2,
              y: rect.center.y + rect.height / 2,
            },
            {
              x: rect.center.x - rect.width / 2,
              y: rect.center.y + rect.height / 2,
            },
            {
              x: rect.center.x - rect.width / 2,
              y: rect.center.y - rect.height / 2,
            },
          ],
          strokeColor: "#f97316",
          strokeWidth: 0.0075,
        })),
        {
          points: board109Outline.outline.filter(
            (point: Point) => point.x > 19.5 && point.y > 19.5,
          ),
          strokeColor: "#2563eb",
          strokeWidth: 0.025,
          label: "physical board outline",
        },
      ],
      texts: [
        {
          x: 20,
          y: 24.1,
          text: `Board 109: ${rects.length} void rectangles`,
          fontSize: 0.12,
          anchorSide: "center_left",
        },
        {
          x: 20,
          y: 23.8,
          text: `${sliverCount} slivers at or below EPS (1e-9 mm)`,
          fontSize: 0.12,
          anchorSide: "center_left",
        },
        {
          x: 20,
          y: 23.5,
          text: `Upper-right detail: ${detailRects.length} intersecting rectangles`,
          fontSize: 0.12,
          anchorSide: "center_left",
        },
      ],
    },
    { svgWidth: 800, svgHeight: 800 },
  )
}
