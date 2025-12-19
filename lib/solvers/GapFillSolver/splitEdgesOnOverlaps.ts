import { EdgeSpatialHashIndex } from "../../data-structures/FlatbushIndex"
import type { RectEdge } from "./types"
import { createEdgeSegment } from "./createEdgeSegment"

export function splitEdgesOnOverlaps(edges: RectEdge[]): RectEdge[] {
  const result: RectEdge[] = []
  const tolerance = 0.01

  const spatialIndex = new EdgeSpatialHashIndex<RectEdge>(edges.length)
  for (const edge of edges) {
    const minX = Math.min(edge.x1, edge.x2)
    const minY = Math.min(edge.y1, edge.y2)
    const maxX = Math.max(edge.x1, edge.x2)
    const maxY = Math.max(edge.y1, edge.y2)
    spatialIndex.insert(edge, minX, minY, maxX, maxY)
  }
  spatialIndex.finish()

  for (const edge of edges) {
    const isHorizontal = Math.abs(edge.normal.y) > 0.5
    const overlappingRanges: Array<{ start: number; end: number }> = []

    const minX = Math.min(edge.x1, edge.x2)
    const minY = Math.min(edge.y1, edge.y2)
    const maxX = Math.max(edge.x1, edge.x2)
    const maxY = Math.max(edge.y1, edge.y2)
    const nearby = spatialIndex.search(minX, minY, maxX, maxY)

    for (const other of nearby) {
      if (edge === other) continue
      if (edge.rect === other.rect) continue
      if (!edge.zLayers.some((z) => other.zLayers.includes(z))) continue

      const isOtherHorizontal = Math.abs(other.normal.y) > 0.5
      if (isHorizontal !== isOtherHorizontal) continue

      if (isHorizontal) {
        if (Math.abs(edge.y1 - other.y1) > tolerance) continue

        const overlapStart = Math.max(edge.x1, other.x1)
        const overlapEnd = Math.min(edge.x2, other.x2)

        if (overlapStart < overlapEnd) {
          const edgeLength = edge.x2 - edge.x1
          overlappingRanges.push({
            start: (overlapStart - edge.x1) / edgeLength,
            end: (overlapEnd - edge.x1) / edgeLength,
          })
        }
      } else {
        if (Math.abs(edge.x1 - other.x1) > tolerance) continue

        const overlapStart = Math.max(edge.y1, other.y1)
        const overlapEnd = Math.min(edge.y2, other.y2)

        if (overlapStart < overlapEnd) {
          const edgeLength = edge.y2 - edge.y1
          overlappingRanges.push({
            start: (overlapStart - edge.y1) / edgeLength,
            end: (overlapEnd - edge.y1) / edgeLength,
          })
        }
      }
    }

    if (overlappingRanges.length === 0) {
      result.push(edge)
      continue
    }

    overlappingRanges.sort((a, b) => a.start - b.start)
    const merged: Array<{ start: number; end: number }> = []
    for (const range of overlappingRanges) {
      if (merged.length === 0 || range.start > merged[merged.length - 1]!.end) {
        merged.push(range)
      } else {
        merged[merged.length - 1]!.end = Math.max(
          merged[merged.length - 1]!.end,
          range.end,
        )
      }
    }

    let pos = 0
    for (const occupied of merged) {
      if (pos < occupied.start) {
        const freeSegment = createEdgeSegment({
          edge,
          start: pos,
          end: occupied.start,
        })
        result.push(freeSegment)
      }
      pos = occupied.end
    }
    if (pos < 1) {
      const freeSegment = createEdgeSegment({ edge, start: pos, end: 1 })
      result.push(freeSegment)
    }
  }
  const edgesWithLength = result.map((edge) => ({
    edge,
    length: Math.abs(edge.x2 - edge.x1) + Math.abs(edge.y2 - edge.y1),
  }))
  edgesWithLength.sort((a, b) => b.length - a.length)

  return edgesWithLength.map((e) => e.edge)
}
