import type { GraphicsObject, Line } from "graphics-debug"
import type { SimpleRouteJson } from "lib/types/srj-types"
export type SimpleRouteOutlineInput = {
  bounds: SimpleRouteJson["bounds"]
  outline?: SimpleRouteJson["outline"]
}

/**
 * Creates a GraphicsObject that draws the SRJ outline (or bounds fallback).
 */
export const makeSimpleRouteOutlineGraphics = (
  srj: SimpleRouteOutlineInput,
): GraphicsObject => {
  const lines: NonNullable<Line[]> = []

  if (srj.outline && srj.outline.length > 1) {
    lines.push({
      points: [...srj.outline, srj.outline[0]!],
      strokeColor: "#111827",
      strokeWidth: 0.1,
      label: "outline",
    })
  } else {
    const { minX, maxX, minY, maxY } = srj.bounds
    lines.push({
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: minY },
      ],
      strokeColor: "#111827",
      strokeWidth: 0.1,
      label: "bounds",
    })
  }

  return {
    title: "SimpleRoute Outline",
    coordinateSystem: "cartesian",
    lines,
    points: [],
  }
}
