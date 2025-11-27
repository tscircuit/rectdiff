// lib/solvers/rectdiff/gapfill/detection.ts
import type { XYRect } from "../types"
import type { GapRegion, LayerContext } from "./types"
import { EPS } from "../geometry"

/**
 * Sweep-line algorithm to find maximal uncovered rectangles on a single layer.
 */
export function findGapsOnLayer(params: {
  bounds: XYRect
  obstacles: XYRect[]
  placed: XYRect[]
  scanResolution: number
}): XYRect[] {
  const { bounds, obstacles, placed, scanResolution } = params
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

/**
 * Merge adjacent uncovered cells into larger rectangles using a greedy approach.
 */
function mergeUncoveredCells(
  cells: Array<{ x: number; y: number; w: number; h: number }>,
): XYRect[] {
  if (cells.length === 0) return []

  // Group cells by their left edge and width
  const byXW = new Map<string, typeof cells>()
  for (const c of cells) {
    const key = `${c.x.toFixed(9)}|${c.w.toFixed(9)}`
    const arr = byXW.get(key) ?? []
    arr.push(c)
    byXW.set(key, arr)
  }

  // Within each vertical strip, merge adjacent cells
  const verticalStrips: XYRect[] = []
  for (const stripCells of byXW.values()) {
    // Sort by y
    stripCells.sort((a, b) => a.y - b.y)

    let current: XYRect | null = null
    for (const c of stripCells) {
      if (!current) {
        current = { x: c.x, y: c.y, width: c.w, height: c.h }
      } else if (Math.abs(current.y + current.height - c.y) < EPS) {
        // Adjacent vertically, merge
        current.height += c.h
      } else {
        // Gap, save current and start new
        verticalStrips.push(current)
        current = { x: c.x, y: c.y, width: c.w, height: c.h }
      }
    }
    if (current) verticalStrips.push(current)
  }

  // Now try to merge horizontal strips with same y and height
  const byYH = new Map<string, XYRect[]>()
  for (const r of verticalStrips) {
    const key = `${r.y.toFixed(9)}|${r.height.toFixed(9)}`
    const arr = byYH.get(key) ?? []
    arr.push(r)
    byYH.set(key, arr)
  }

  const merged: XYRect[] = []
  for (const rowRects of byYH.values()) {
    // Sort by x
    rowRects.sort((a, b) => a.x - b.x)

    let current: XYRect | null = null
    for (const r of rowRects) {
      if (!current) {
        current = { ...r }
      } else if (Math.abs(current.x + current.width - r.x) < EPS) {
        // Adjacent horizontally, merge
        current.width += r.width
      } else {
        // Gap, save current and start new
        merged.push(current)
        current = { ...r }
      }
    }
    if (current) merged.push(current)
  }

  return merged
}

/**
 * Find gaps across all layers and return GapRegions with z-layer info.
 */
export function findAllGaps(
  params: {
    scanResolution: number
    minWidth: number
    minHeight: number
  },
  ctx: LayerContext,
): GapRegion[] {
  const { scanResolution, minWidth, minHeight } = params
  const { bounds, layerCount, obstaclesByLayer, placedByLayer } = ctx

  // Find gaps on each layer
  const gapsByLayer: XYRect[][] = []
  for (let z = 0; z < layerCount; z++) {
    const obstacles = obstaclesByLayer[z] ?? []
    const placed = placedByLayer[z] ?? []
    const gaps = findGapsOnLayer({ bounds, obstacles, placed, scanResolution })
    gapsByLayer.push(gaps)
  }

  // Convert to GapRegions with z-layer info
  const allGaps: GapRegion[] = []

  for (let z = 0; z < layerCount; z++) {
    for (const gap of gapsByLayer[z]!) {
      // Filter out gaps that are too small
      if (gap.width < minWidth - EPS || gap.height < minHeight - EPS) continue

      // Check if this gap exists on adjacent layers too
      const zLayers = [z]

      // Look up
      for (let zu = z + 1; zu < layerCount; zu++) {
        const hasOverlap = gapsByLayer[zu]!.some((g) => rectsOverlap(g, gap))
        if (hasOverlap) zLayers.push(zu)
        else break
      }

      // Look down (if z > 0 and not already counted)
      for (let zd = z - 1; zd >= 0; zd--) {
        const hasOverlap = gapsByLayer[zd]!.some((g) => rectsOverlap(g, gap))
        if (hasOverlap && !zLayers.includes(zd)) zLayers.unshift(zd)
        else break
      }

      allGaps.push({
        rect: gap,
        zLayers: zLayers.sort((a, b) => a - b),
        centerX: gap.x + gap.width / 2,
        centerY: gap.y + gap.height / 2,
        area: gap.width * gap.height,
      })
    }
  }

  // Deduplicate gaps that are essentially the same across layers
  const deduped = deduplicateGaps(allGaps)

  // Sort by priority: prefer larger gaps and multi-layer gaps
  deduped.sort((a, b) => {
    // Prefer multi-layer gaps
    const layerDiff = b.zLayers.length - a.zLayers.length
    if (layerDiff !== 0) return layerDiff
    // Then prefer larger area
    return b.area - a.area
  })

  return deduped
}

function rectsOverlap(a: XYRect, b: XYRect): boolean {
  return !(
    a.x + a.width <= b.x + EPS ||
    b.x + b.width <= a.x + EPS ||
    a.y + a.height <= b.y + EPS ||
    b.y + b.height <= a.y + EPS
  )
}

function rectsEqual(a: XYRect, b: XYRect): boolean {
  return (
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS
  )
}

function deduplicateGaps(gaps: GapRegion[]): GapRegion[] {
  const result: GapRegion[] = []

  for (const gap of gaps) {
    // Check if we already have a gap at the same location with overlapping layers
    const existing = result.find(
      (g) =>
        rectsEqual(g.rect, gap.rect) ||
        (rectsOverlap(g.rect, gap.rect) &&
          gap.zLayers.some((z) => g.zLayers.includes(z))),
    )

    if (!existing) {
      result.push(gap)
    } else if (gap.zLayers.length > existing.zLayers.length) {
      // Replace with the one that has more layers
      const idx = result.indexOf(existing)
      result[idx] = gap
    }
  }

  return result
}
