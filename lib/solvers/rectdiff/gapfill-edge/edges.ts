// lib/solvers/rectdiff/gapfill-edge/edges.ts
import type { XYRect, Placed3D } from "../types"
import type { RectEdge } from "./types"
import { EPS } from "../geometry"

/**
 * Extract all edges from a list of placed rectangles.
 */
export function extractAllEdges(placed: Placed3D[]): RectEdge[] {
  const edges: RectEdge[] = []

  for (const p of placed) {
    const { rect, zLayers } = p

    // Top edge (horizontal, left to right)
    edges.push({
      rect,
      side: "top",
      orientation: "horizontal",
      start: { x: rect.x, y: rect.y },
      end: { x: rect.x + rect.width, y: rect.y },
      zLayers: [...zLayers],
    })

    // Right edge (vertical, top to bottom)
    edges.push({
      rect,
      side: "right",
      orientation: "vertical",
      start: { x: rect.x + rect.width, y: rect.y },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      zLayers: [...zLayers],
    })

    // Bottom edge (horizontal, right to left)
    edges.push({
      rect,
      side: "bottom",
      orientation: "horizontal",
      start: { x: rect.x + rect.width, y: rect.y + rect.height },
      end: { x: rect.x, y: rect.y + rect.height },
      zLayers: [...zLayers],
    })

    // Left edge (vertical, bottom to top)
    edges.push({
      rect,
      side: "left",
      orientation: "vertical",
      start: { x: rect.x, y: rect.y + rect.height },
      end: { x: rect.x, y: rect.y },
      zLayers: [...zLayers],
    })
  }

  return edges
}

/**
 * Check if two edges are parallel.
 */
export function areEdgesParallel(e1: RectEdge, e2: RectEdge): boolean {
  return e1.orientation === e2.orientation
}

/**
 * Calculate the distance between two parallel edges.
 * For horizontal edges, this is the vertical distance.
 * For vertical edges, this is the horizontal distance.
 */
export function distanceBetweenParallelEdges(
  e1: RectEdge,
  e2: RectEdge,
): number {
  if (!areEdgesParallel(e1, e2)) {
    return Infinity
  }

  if (e1.orientation === "horizontal") {
    // Vertical distance between horizontal edges
    return Math.abs(e1.start.y - e2.start.y)
  } else {
    // Horizontal distance between vertical edges
    return Math.abs(e1.start.x - e2.start.x)
  }
}

/**
 * Check if two parallel edges overlap in their projection.
 * For horizontal edges, check x-range overlap.
 * For vertical edges, check y-range overlap.
 */
export function edgesOverlapInProjection(e1: RectEdge, e2: RectEdge): boolean {
  if (!areEdgesParallel(e1, e2)) {
    return false
  }

  if (e1.orientation === "horizontal") {
    // Check x-range overlap
    const e1MinX = Math.min(e1.start.x, e1.end.x)
    const e1MaxX = Math.max(e1.start.x, e1.end.x)
    const e2MinX = Math.min(e2.start.x, e2.end.x)
    const e2MaxX = Math.max(e2.start.x, e2.end.x)

    return !(e1MaxX <= e2MinX + EPS || e2MaxX <= e1MinX + EPS)
  } else {
    // Check y-range overlap
    const e1MinY = Math.min(e1.start.y, e1.end.y)
    const e1MaxY = Math.max(e1.start.y, e1.end.y)
    const e2MinY = Math.min(e2.start.y, e2.end.y)
    const e2MaxY = Math.max(e2.start.y, e2.end.y)

    return !(e1MaxY <= e2MinY + EPS || e2MaxY <= e1MinY + EPS)
  }
}

/**
 * Find all edges that are parallel and close to the primary edge.
 */
export function findNearbyEdges(
  primaryEdge: RectEdge,
  allEdges: RectEdge[],
  maxDistance: number,
): RectEdge[] {
  const nearby: RectEdge[] = []

  for (const edge of allEdges) {
    // Skip the primary edge itself
    if (edge === primaryEdge) continue

    // Must be parallel
    if (!areEdgesParallel(primaryEdge, edge)) continue

    // Must be close enough
    const distance = distanceBetweenParallelEdges(primaryEdge, edge)
    if (distance > maxDistance + EPS) continue

    // Should overlap in projection (or be very close)
    if (!edgesOverlapInProjection(primaryEdge, edge)) {
      // Allow edges that are close even if they don't overlap
      if (distance > maxDistance * 0.5) continue
    }

    nearby.push(edge)
  }

  return nearby
}
