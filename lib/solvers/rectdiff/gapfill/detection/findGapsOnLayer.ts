// lib/solvers/rectdiff/gapfill/detection/findGapsOnLayer.ts
import type { XYRect } from "../../types"
import { EPS } from "../../geometry"

import { mergeUncoveredCells } from "./mergeUncoveredCells"

/**
 * Sweep-line algorithm to find maximal uncovered rectangles on a single layer.
 */
export function findGapsOnLayer({
  bounds,
  obstacles,
  placed,
  scanResolution,
}: {
  bounds: XYRect
  obstacles: XYRect[]
  placed: XYRect[]
  scanResolution: number
}): XYRect[] {
  const blockers = [...obstacles, ...placed]

  // Collect all unique x-coordinates
  const xCoords = new Set<number>()
  xCoords.add(bounds.x)
  xCoords.add(bounds.x + bounds.width)

  for (const b of blockers) {
    if (b.x > bounds.x && b.x < bounds.x + bounds.width) {
      xCoords.add(b.x)
    }
    if (b.x + b.width > bounds.x && b.x + b.width < bounds.x + bounds.width) {
      xCoords.add(b.x + b.width)
    }
  }

  // Also add intermediate points based on scan resolution
  for (let x = bounds.x; x <= bounds.x + bounds.width; x += scanResolution) {
    xCoords.add(x)
  }

  const sortedX = Array.from(xCoords).sort((a, b) => a - b)

  // Similarly for y-coordinates
  const yCoords = new Set<number>()
  yCoords.add(bounds.y)
  yCoords.add(bounds.y + bounds.height)

  for (const b of blockers) {
    if (b.y > bounds.y && b.y < bounds.y + bounds.height) {
      yCoords.add(b.y)
    }
    if (
      b.y + b.height > bounds.y &&
      b.y + b.height < bounds.y + bounds.height
    ) {
      yCoords.add(b.y + b.height)
    }
  }

  for (let y = bounds.y; y <= bounds.y + bounds.height; y += scanResolution) {
    yCoords.add(y)
  }

  const sortedY = Array.from(yCoords).sort((a, b) => a - b)

  // Build a grid of cells and mark which are uncovered
  const uncoveredCells: Array<{ x: number; y: number; w: number; h: number }> =
    []

  for (let i = 0; i < sortedX.length - 1; i++) {
    for (let j = 0; j < sortedY.length - 1; j++) {
      const cellX = sortedX[i]!
      const cellY = sortedY[j]!
      const cellW = sortedX[i + 1]! - cellX
      const cellH = sortedY[j + 1]! - cellY

      if (cellW <= EPS || cellH <= EPS) continue

      // Check if this cell is covered by any blocker
      const cellCenterX = cellX + cellW / 2
      const cellCenterY = cellY + cellH / 2

      const isCovered = blockers.some(
        (b) =>
          cellCenterX >= b.x - EPS &&
          cellCenterX <= b.x + b.width + EPS &&
          cellCenterY >= b.y - EPS &&
          cellCenterY <= b.y + b.height + EPS,
      )

      if (!isCovered) {
        uncoveredCells.push({ x: cellX, y: cellY, w: cellW, h: cellH })
      }
    }
  }

  // Merge adjacent uncovered cells into maximal rectangles
  return mergeUncoveredCells(uncoveredCells)
}
