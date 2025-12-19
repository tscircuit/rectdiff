import type { RectEdge } from "./types"
import type { XYRect } from "../rectdiff/types"
import { createEdgeSegment } from "./createEdgeSegment"

export function splitEdgeAroundRects(
  edge: RectEdge,
  overlappingRects: XYRect[],
): RectEdge[] {
  const result: RectEdge[] = []
  const tolerance = 0.01
  const isHorizontal = Math.abs(edge.normal.y) > 0.5
  const overlappingRanges: Array<{ start: number; end: number }> = []

  // Calculate which portions of the edge overlap with rectangles
  for (const rect of overlappingRects) {
    if (isHorizontal) {
      // Edge is horizontal - check for x-overlap
      if (
        Math.abs(edge.y1 - rect.y) > tolerance &&
        Math.abs(edge.y1 - (rect.y + rect.height)) > tolerance
      ) {
        continue // Rect doesn't align with this horizontal edge
      }

      const overlapStart = Math.max(edge.x1, rect.x)
      const overlapEnd = Math.min(edge.x2, rect.x + rect.width)

      if (overlapStart < overlapEnd) {
        const edgeLength = edge.x2 - edge.x1
        overlappingRanges.push({
          start: (overlapStart - edge.x1) / edgeLength,
          end: (overlapEnd - edge.x1) / edgeLength,
        })
      }
    } else {
      // Edge is vertical - check for y-overlap
      if (
        Math.abs(edge.x1 - rect.x) > tolerance &&
        Math.abs(edge.x1 - (rect.x + rect.width)) > tolerance
      ) {
        continue // Rect doesn't align with this vertical edge
      }

      const overlapStart = Math.max(edge.y1, rect.y)
      const overlapEnd = Math.min(edge.y2, rect.y + rect.height)

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
    // No overlaps found, return original edge
    return [edge]
  }

  // Merge overlapping ranges
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

  // Extract free (non-overlapping) segments
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

  return result
}
