import type { XYRect } from "../../rectdiff-types"
import {
  containsPoint,
  subtractRect2D,
  EPS,
} from "../../utils/rectdiff-geometry"
import { isPointInPolygon } from "./isPointInPolygon"

/**
 * Simplify a polygon by reducing coordinate precision to avoid excessive grid cells.
 * This rounds coordinates to a grid and removes duplicates.
 */
function simplifyPolygon(
  polygon: Array<{ x: number; y: number }>,
  precision: number,
): Array<{ x: number; y: number }> {
  const round = (v: number) => Math.round(v / precision) * precision
  const seen = new Set<string>()
  const result: Array<{ x: number; y: number }> = []

  for (const p of polygon) {
    const rx = round(p.x)
    const ry = round(p.y)
    const key = `${rx},${ry}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ x: rx, y: ry })
    }
  }

  return result
}

/**
 * Decompose the empty space inside 'bounds' but outside 'polygon' into rectangles.
 * This uses a coordinate grid approach, ideal for rectilinear polygons.
 */
export function computeInverseRects(
  bounds: XYRect,
  polygon: Array<{ x: number; y: number }>,
): XYRect[] {
  if (!polygon || polygon.length < 3) return []

  // Simplify polygon if it has too many points to avoid O(n^2) performance issues
  // A polygon with 350+ points (like rounded corners) creates too many grid cells
  const MAX_POLYGON_POINTS = 100
  const workingPolygon =
    polygon.length > MAX_POLYGON_POINTS
      ? simplifyPolygon(
          polygon,
          Math.max(bounds.width, bounds.height) / MAX_POLYGON_POINTS,
        )
      : polygon

  // 1. Collect unique sorted X and Y coordinates
  const xs = new Set<number>([bounds.x, bounds.x + bounds.width])
  const ys = new Set<number>([bounds.y, bounds.y + bounds.height])
  for (const p of workingPolygon) {
    xs.add(p.x)
    ys.add(p.y)
  }
  const xSorted = Array.from(xs).sort((a, b) => a - b)
  const ySorted = Array.from(ys).sort((a, b) => a - b)

  // 2. Generate grid cells and classify them
  const rawRects: XYRect[] = []
  for (let i = 0; i < xSorted.length - 1; i++) {
    for (let j = 0; j < ySorted.length - 1; j++) {
      const x0 = xSorted[i]!
      const x1 = xSorted[i + 1]!
      const y0 = ySorted[j]!
      const y1 = ySorted[j + 1]!

      // Check center point
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2

      // If NOT in polygon, it's a void rect
      if (
        cx >= bounds.x &&
        cx <= bounds.x + bounds.width &&
        cy >= bounds.y &&
        cy <= bounds.y + bounds.height
      ) {
        if (!isPointInPolygon({ x: cx, y: cy }, polygon)) {
          rawRects.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 })
        }
      }
    }
  }

  // 3. Simple merge pass (horizontal)
  const finalRects: XYRect[] = []

  // Sort by y then x
  rawRects.sort((a, b) => {
    if (Math.abs(a.y - b.y) > EPS) return a.y - b.y
    return a.x - b.x
  })

  let current: XYRect | null = null
  for (const r of rawRects) {
    if (!current) {
      current = r
      continue
    }

    const sameY = Math.abs(current.y - r.y) < EPS
    const sameHeight = Math.abs(current.height - r.height) < EPS
    const touchesX = Math.abs(current.x + current.width - r.x) < EPS

    if (sameY && sameHeight && touchesX) {
      current.width += r.width
    } else {
      finalRects.push(current)
      current = r
    }
  }
  if (current) finalRects.push(current)

  // 4. Vertical merge pass
  finalRects.sort((a, b) => {
    if (Math.abs(a.x - b.x) > EPS) return a.x - b.x
    return a.y - b.y
  })

  const mergedVertical: XYRect[] = []
  current = null
  for (const r of finalRects) {
    if (!current) {
      current = r
      continue
    }
    const sameX = Math.abs(current.x - r.x) < EPS
    const sameWidth = Math.abs(current.width - r.width) < EPS
    const touchesY = Math.abs(current.y + current.height - r.y) < EPS

    if (sameX && sameWidth && touchesY) {
      current.height += r.height
    } else {
      mergedVertical.push(current)
      current = r
    }
  }
  if (current) mergedVertical.push(current)

  return mergedVertical
}
