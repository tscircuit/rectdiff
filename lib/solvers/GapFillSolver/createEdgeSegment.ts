import type { RectEdge } from "./types"

export function createEdgeSegment(
  edge: RectEdge,
  start: number,
  end: number,
): RectEdge {
  const isHorizontal = Math.abs(edge.normal.y) > 0.5

  if (isHorizontal) {
    const length = edge.x2 - edge.x1
    return {
      ...edge,
      x1: edge.x1 + start * length,
      x2: edge.x1 + end * length,
    }
  } else {
    const length = edge.y2 - edge.y1
    return {
      ...edge,
      y1: edge.y1 + start * length,
      y2: edge.y1 + end * length,
    }
  }
}
