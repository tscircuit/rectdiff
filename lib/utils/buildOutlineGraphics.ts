import type { GraphicsObject, Line } from "graphics-debug"
import type { SimpleRouteJson } from "../types/srj-types"

export type BuildOutlineParams = { srj: SimpleRouteJson }

export const buildOutlineGraphics = ({
  srj,
}: BuildOutlineParams): GraphicsObject => {
  const hasOutline = srj.outline && srj.outline.length > 1
  const lines: NonNullable<Line[]> = hasOutline
    ? [
        {
          points: [...srj.outline!, srj.outline![0]!],
          strokeColor: "#111827",
          strokeWidth: 0.1,
          label: "outline",
        },
      ]
    : [
        {
          points: [
            { x: srj.bounds.minX, y: srj.bounds.minY },
            { x: srj.bounds.maxX, y: srj.bounds.minY },
            { x: srj.bounds.maxX, y: srj.bounds.maxY },
            { x: srj.bounds.minX, y: srj.bounds.maxY },
            { x: srj.bounds.minX, y: srj.bounds.minY },
          ],
          strokeColor: "#111827",
          strokeWidth: 0.1,
          label: "bounds",
        },
      ]

  return {
    title: "SimpleRoute Outline",
    coordinateSystem: "cartesian",
    lines,
  }
}
