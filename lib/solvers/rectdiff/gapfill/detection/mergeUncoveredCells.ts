// lib/solvers/rectdiff/gapfill/detection/mergeUncoveredCells.ts
import type { XYRect } from "../../types"
import { EPS } from "../../geometry"

/**
 * Merge adjacent uncovered cells into larger rectangles using a greedy approach.
 */
export function mergeUncoveredCells(
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
