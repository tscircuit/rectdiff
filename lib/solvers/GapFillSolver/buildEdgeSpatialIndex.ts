import { EdgeSpatialHashIndex } from "../../data-structures/FlatbushIndex"
import type { RectEdge } from "./types"

export function buildEdgeSpatialIndex(
  edges: RectEdge[],
  maxEdgeDistance: number,
): EdgeSpatialHashIndex<RectEdge> {
  const index = new EdgeSpatialHashIndex<RectEdge>(edges.length)

  for (const edge of edges) {
    const minX = Math.min(edge.x1, edge.x2) - maxEdgeDistance
    const minY = Math.min(edge.y1, edge.y2) - maxEdgeDistance
    const maxX = Math.max(edge.x1, edge.x2) + maxEdgeDistance
    const maxY = Math.max(edge.y1, edge.y2) + maxEdgeDistance

    index.insert(edge, minX, minY, maxX, maxY)
  }

  index.finish()
  return index
}
