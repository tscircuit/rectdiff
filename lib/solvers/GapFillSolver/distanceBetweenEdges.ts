import type { RectEdge } from "./types"

export function distanceBetweenEdges(edge1: RectEdge, edge2: RectEdge): number {
  if (Math.abs(edge1.normal.y) > 0.5) {
    return Math.abs(edge1.y1 - edge2.y1)
  }
  return Math.abs(edge1.x1 - edge2.x1)
}
