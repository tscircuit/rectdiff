// lib/solvers/rectdiff/gapfill-edge/segments.ts
import type { RectEdge } from "./types"
import type { XYRect } from "../types"
import { EPS } from "../geometry"

/**
 * Find unoccupied segments along a primary edge.
 * An unoccupied segment is a portion of the edge that is not covered by
 * any nearby edges or obstacles.
 */
export function findUnoccupiedSegments(
  primaryEdge: RectEdge,
  nearbyEdges: RectEdge[],
  obstacles: XYRect[],
  minSegmentLength: number,
): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = []

  // Get the coordinate range of the primary edge
  let edgeStart: number
  let edgeEnd: number

  if (primaryEdge.orientation === "horizontal") {
    edgeStart = Math.min(primaryEdge.start.x, primaryEdge.end.x)
    edgeEnd = Math.max(primaryEdge.start.x, primaryEdge.end.x)
  } else {
    edgeStart = Math.min(primaryEdge.start.y, primaryEdge.end.y)
    edgeEnd = Math.max(primaryEdge.start.y, primaryEdge.end.y)
  }

  // Collect all covering intervals from nearby edges and obstacles
  const coveringIntervals: Array<{ start: number; end: number }> = []

  // Add intervals from nearby edges (they run parallel, so they cover the edge)
  for (const edge of nearbyEdges) {
    if (primaryEdge.orientation === "horizontal") {
      const eStart = Math.min(edge.start.x, edge.end.x)
      const eEnd = Math.max(edge.start.x, edge.end.x)
      coveringIntervals.push({ start: eStart, end: eEnd })
    } else {
      const eStart = Math.min(edge.start.y, edge.end.y)
      const eEnd = Math.max(edge.start.y, edge.end.y)
      coveringIntervals.push({ start: eStart, end: eEnd })
    }
  }

  // Add intervals from obstacles that overlap with the edge
  const edgeY = primaryEdge.start.y
  const edgeX = primaryEdge.start.x

  for (const obstacle of obstacles) {
    if (primaryEdge.orientation === "horizontal") {
      // For horizontal edge, check if obstacle covers it vertically
      if (
        obstacle.y <= edgeY + EPS &&
        obstacle.y + obstacle.height >= edgeY - EPS
      ) {
        const oStart = Math.max(edgeStart, obstacle.x)
        const oEnd = Math.min(edgeEnd, obstacle.x + obstacle.width)
        if (oEnd > oStart + EPS) {
          coveringIntervals.push({ start: oStart, end: oEnd })
        }
      }
    } else {
      // For vertical edge, check if obstacle covers it horizontally
      if (
        obstacle.x <= edgeX + EPS &&
        obstacle.x + obstacle.width >= edgeX - EPS
      ) {
        const oStart = Math.max(edgeStart, obstacle.y)
        const oEnd = Math.min(edgeEnd, obstacle.y + obstacle.height)
        if (oEnd > oStart + EPS) {
          coveringIntervals.push({ start: oStart, end: oEnd })
        }
      }
    }
  }

  // Sort intervals by start position
  coveringIntervals.sort((a, b) => a.start - b.start)

  // Merge overlapping intervals
  const merged: Array<{ start: number; end: number }> = []
  for (const interval of coveringIntervals) {
    if (merged.length === 0) {
      merged.push({ ...interval })
    } else {
      const last = merged[merged.length - 1]!
      if (interval.start <= last.end + EPS) {
        // Overlaps or adjacent, merge
        last.end = Math.max(last.end, interval.end)
      } else {
        // New interval
        merged.push({ ...interval })
      }
    }
  }

  // Find uncovered segments
  let currentPos = edgeStart

  for (const interval of merged) {
    if (interval.start > currentPos + EPS) {
      // Found an uncovered segment
      const segmentLength = interval.start - currentPos
      if (segmentLength >= minSegmentLength - EPS) {
        segments.push({ start: currentPos, end: interval.start })
      }
    }
    currentPos = Math.max(currentPos, interval.end)
  }

  // Check for uncovered segment at the end
  if (currentPos < edgeEnd - EPS) {
    const segmentLength = edgeEnd - currentPos
    if (segmentLength >= minSegmentLength - EPS) {
      segments.push({ start: currentPos, end: edgeEnd })
    }
  }

  return segments
}

/**
 * Generate expansion points from unoccupied segments.
 * Each point is placed outside the edge (in the direction away from the rect).
 */
export function generateExpansionPoints(
  primaryEdge: RectEdge,
  unoccupiedSegments: Array<{ start: number; end: number }>,
  zLayers: number[],
  offset: number = 0.1,
): Array<{ x: number; y: number; zLayers: number[] }> {
  const points: Array<{ x: number; y: number; zLayers: number[] }> = []

  for (const segment of unoccupiedSegments) {
    // Calculate the center of the segment
    const segmentCenter = (segment.start + segment.end) / 2

    let x: number
    let y: number

    if (primaryEdge.orientation === "horizontal") {
      x = segmentCenter
      // Place point outside the edge based on which side
      if (primaryEdge.side === "top") {
        y = primaryEdge.start.y - offset // Above the top edge
      } else {
        y = primaryEdge.start.y + offset // Below the bottom edge
      }
    } else {
      y = segmentCenter
      // Place point outside the edge based on which side
      if (primaryEdge.side === "right") {
        x = primaryEdge.start.x + offset // To the right of the right edge
      } else {
        x = primaryEdge.start.x - offset // To the left of the left edge
      }
    }

    points.push({ x, y, zLayers: [...zLayers] })
  }

  return points
}
