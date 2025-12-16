// lib/solvers/rectdiff/edge-expansion-gapfill/calculateMaxExpansion.ts
import type { Direction } from "./types"

/**
 * Calculate the maximum expansion amount that respects aspect ratio constraint.
 *
 * When expanding a node, we need to ensure the resulting rectangle doesn't exceed
 * the maximum aspect ratio. This function calculates how much we can expand in a
 * given direction while staying within the aspect ratio limit.
 *
 * @param currentWidth - Current width of the node
 * @param currentHeight - Current height of the node
 * @param direction - Direction of expansion (up/down/left/right)
 * @param available - Available space to expand into
 * @param maxAspectRatio - Maximum allowed aspect ratio (width/height or height/width), or null for no limit
 * @returns Maximum expansion amount that respects aspect ratio, clamped to available space
 */
export function calculateMaxExpansion(params: {
  currentWidth: number
  currentHeight: number
  direction: Direction
  available: number
  maxAspectRatio: number | null
}): number {
  const { currentWidth, currentHeight, direction, available, maxAspectRatio } =
    params

  // If no aspect ratio constraint, return full available space
  if (maxAspectRatio === null) {
    return available
  }

  let maxExpansion = available

  if (direction === "left" || direction === "right") {
    // Expanding horizontally
    // We want: (currentWidth + expansion) / currentHeight <= maxAspectRatio
    // So: expansion <= currentHeight * maxAspectRatio - currentWidth
    const maxWidth = currentHeight * maxAspectRatio
    maxExpansion = Math.min(available, maxWidth - currentWidth)
  } else {
    // Expanding vertically (up or down)
    // We want: (currentHeight + expansion) / currentWidth <= maxAspectRatio
    // So: expansion <= currentWidth * maxAspectRatio - currentHeight
    const maxHeight = currentWidth * maxAspectRatio
    maxExpansion = Math.min(available, maxHeight - currentHeight)
  }

  // Ensure we don't return negative values
  return Math.max(0, maxExpansion)
}
