import { distanceBetweenEdges } from "./distanceBetweenEdges"
import type { RectEdge } from "./types"

export function isNearbyParallelEdge(
  primaryEdge: RectEdge,
  candidate: RectEdge,
  minTraceWidth: number,
  maxEdgeDistance: number,
): boolean {
  const dotProduct =
    primaryEdge.normal.x * candidate.normal.x +
    primaryEdge.normal.y * candidate.normal.y

  if (dotProduct >= -0.9) return false

  const sharedLayers = primaryEdge.zLayers.filter((z) =>
    candidate.zLayers.includes(z),
  )
  if (sharedLayers.length === 0) return false

  const distance = distanceBetweenEdges(primaryEdge, candidate)
  const minGap = Math.max(minTraceWidth, 0.1)
  if (distance < minGap) {
    return false
  }
  if (distance > maxEdgeDistance) {
    return false
  }

  return true
}
