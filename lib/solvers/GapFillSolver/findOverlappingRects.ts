import type { Placed3D, XYRect } from "../rectdiff/types"
import { overlaps } from "../rectdiff/geometry"

export function findOverlappingRects(
  candidateRect: XYRect,
  candidateZLayers: number[],
  inputRects: Placed3D[],
  filledRects: Placed3D[],
  obstaclesByLayer: XYRect[][],
): XYRect[] {
  const overlappingRects: XYRect[] = []

  // Check filled rects
  for (const existing of filledRects) {
    if (
      candidateZLayers.some((z) => existing.zLayers.includes(z)) &&
      overlaps(candidateRect, existing.rect)
    ) {
      overlappingRects.push(existing.rect)
    }
  }

  // Check input rects
  for (const input of inputRects) {
    if (
      candidateZLayers.some((z) => input.zLayers.includes(z)) &&
      overlaps(candidateRect, input.rect)
    ) {
      overlappingRects.push(input.rect)
    }
  }

  // Check obstacles
  for (const z of candidateZLayers) {
    const obstacles = obstaclesByLayer[z] ?? []
    for (const obstacle of obstacles) {
      if (overlaps(candidateRect, obstacle)) {
        overlappingRects.push(obstacle)
      }
    }
  }

  return overlappingRects
}
