// lib/solvers/rectdiff/geometry.ts
import type { XYRect } from "./types"

export const EPS = 1e-9
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const gt = (a: number, b: number) => a > b + EPS
export const gte = (a: number, b: number) => a > b - EPS
export const lt = (a: number, b: number) => a < b - EPS
export const lte = (a: number, b: number) => a < b + EPS

export function overlaps(a: XYRect, b: XYRect) {
  return !(
    a.x + a.width <= b.x + EPS ||
    b.x + b.width <= a.x + EPS ||
    a.y + a.height <= b.y + EPS ||
    b.y + b.height <= a.y + EPS
  )
}

export function containsPoint(r: XYRect, x: number, y: number) {
  return (
    x >= r.x - EPS && x <= r.x + r.width + EPS &&
    y >= r.y - EPS && y <= r.y + r.height + EPS
  )
}

export function distancePointToRectEdges(px: number, py: number, r: XYRect) {
  const edges: [number, number, number, number][] = [
    [r.x, r.y, r.x + r.width, r.y],
    [r.x + r.width, r.y, r.x + r.width, r.y + r.height],
    [r.x + r.width, r.y + r.height, r.x, r.y + r.height],
    [r.x, r.y + r.height, r.x, r.y],
  ]
  let best = Infinity
  for (const [x1, y1, x2, y2] of edges) {
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let t = lenSq !== 0 ? dot / lenSq : 0
    t = clamp(t, 0, 1)
    const xx = x1 + t * C
    const yy = y1 + t * D
    best = Math.min(best, Math.hypot(px - xx, py - yy))
  }
  return best
}

// --- directional expansion caps (respect board + blockers + aspect) ---

function maxExpandRight(
  r: XYRect, bounds: XYRect, blockers: XYRect[], maxAspect: number | null | undefined
) {
  let maxWidth = bounds.x + bounds.width - r.x
  for (const b of blockers) {
    const verticallyOverlaps = r.y + r.height > b.y + EPS && b.y + b.height > r.y + EPS
    if (verticallyOverlaps && gte(b.x, r.x + r.width)) {
      maxWidth = Math.min(maxWidth, b.x - r.x)
    }
  }
  let e = Math.max(0, maxWidth - r.width)
  if (e <= 0) return 0
  if (maxAspect != null) {
    const w = r.width, h = r.height
    if (w >= h) e = Math.min(e, maxAspect * h - w)
  }
  return Math.max(0, e)
}

function maxExpandDown(
  r: XYRect, bounds: XYRect, blockers: XYRect[], maxAspect: number | null | undefined
) {
  let maxHeight = bounds.y + bounds.height - r.y
  for (const b of blockers) {
    const horizOverlaps = r.x + r.width > b.x + EPS && b.x + b.width > r.x + EPS
    if (horizOverlaps && gte(b.y, r.y + r.height)) {
      maxHeight = Math.min(maxHeight, b.y - r.y)
    }
  }
  let e = Math.max(0, maxHeight - r.height)
  if (e <= 0) return 0
  if (maxAspect != null) {
    const w = r.width, h = r.height
    if (h >= w) e = Math.min(e, maxAspect * w - h)
  }
  return Math.max(0, e)
}

function maxExpandLeft(
  r: XYRect, bounds: XYRect, blockers: XYRect[], maxAspect: number | null | undefined
) {
  let minX = bounds.x
  for (const b of blockers) {
    const verticallyOverlaps = r.y + r.height > b.y + EPS && b.y + b.height > r.y + EPS
    if (verticallyOverlaps && lte(b.x + b.width, r.x)) {
      minX = Math.max(minX, b.x + b.width)
    }
  }
  let e = Math.max(0, r.x - minX)
  if (e <= 0) return 0
  if (maxAspect != null) {
    const w = r.width, h = r.height
    if (w >= h) e = Math.min(e, maxAspect * h - w)
  }
  return Math.max(0, e)
}

function maxExpandUp(
  r: XYRect, bounds: XYRect, blockers: XYRect[], maxAspect: number | null | undefined
) {
  let minY = bounds.y
  for (const b of blockers) {
    const horizOverlaps = r.x + r.width > b.x + EPS && b.x + b.width > r.x + EPS
    if (horizOverlaps && lte(b.y + b.height, r.y)) {
      minY = Math.max(minY, b.y + b.height)
    }
  }
  let e = Math.max(0, r.y - minY)
  if (e <= 0) return 0
  if (maxAspect != null) {
    const w = r.width, h = r.height
    if (h >= w) e = Math.min(e, maxAspect * w - h)
  }
  return Math.max(0, e)
}

/** Grow a rect around (startX,startY), honoring bounds/blockers/aspect/min sizes */
export function expandRectFromSeed(
  startX: number,
  startY: number,
  gridSize: number,
  bounds: XYRect,
  blockers: XYRect[],
  initialCellRatio: number,
  maxAspectRatio: number | null | undefined,
  minReq: { width: number; height: number },
): XYRect | null {
  const minSide = Math.max(1e-9, gridSize * initialCellRatio)
  const initialW = Math.max(minSide, minReq.width)
  const initialH = Math.max(minSide, minReq.height)

  const strategies = [
    { ox: 0, oy: 0 },
    { ox: -initialW, oy: 0 },
    { ox: 0, oy: -initialH },
    { ox: -initialW, oy: -initialH },
    { ox: -initialW / 2, oy: -initialH / 2 },
  ]

  let best: XYRect | null = null
  let bestArea = 0

  STRATS: for (const s of strategies) {
    let r: XYRect = { x: startX + s.ox, y: startY + s.oy, width: initialW, height: initialH }

    // keep initial inside board
    if (lt(r.x, bounds.x) || lt(r.y, bounds.y) ||
        gt(r.x + r.width, bounds.x + bounds.width) ||
        gt(r.y + r.height, bounds.y + bounds.height)) {
      continue
    }

    // no initial overlap
    for (const b of blockers) if (overlaps(r, b)) continue STRATS

    // greedy expansions in 4 directions
    let improved = true
    while (improved) {
      improved = false
      const eR = maxExpandRight(r, bounds, blockers, maxAspectRatio)
      if (eR > 0) { r = { ...r, width: r.width + eR }; improved = true }

      const eD = maxExpandDown(r, bounds, blockers, maxAspectRatio)
      if (eD > 0) { r = { ...r, height: r.height + eD }; improved = true }

      const eL = maxExpandLeft(r, bounds, blockers, maxAspectRatio)
      if (eL > 0) { r = { x: r.x - eL, y: r.y, width: r.width + eL, height: r.height }; improved = true }

      const eU = maxExpandUp(r, bounds, blockers, maxAspectRatio)
      if (eU > 0) { r = { x: r.x, y: r.y - eU, width: r.width, height: r.height + eU }; improved = true }
    }

    if (r.width + EPS >= minReq.width && r.height + EPS >= minReq.height) {
      const area = r.width * r.height
      if (area > bestArea) { best = r; bestArea = area }
    }
  }

  return best
}
