import type { XYRect } from "../rectdiff-types"

export const EPS = 1e-9
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))
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

export function containsPoint(r: XYRect, p: { x: number; y: number }) {
  return (
    p.x >= r.x - EPS &&
    p.x <= r.x + r.width + EPS &&
    p.y >= r.y - EPS &&
    p.y <= r.y + r.height + EPS
  )
}

export function distancePointToRectEdges(
  p: { x: number; y: number },
  r: XYRect,
) {
  const edges: [number, number, number, number][] = [
    [r.x, r.y, r.x + r.width, r.y],
    [r.x + r.width, r.y, r.x + r.width, r.y + r.height],
    [r.x + r.width, r.y + r.height, r.x, r.y + r.height],
    [r.x, r.y + r.height, r.x, r.y],
  ]
  let best = Infinity
  for (const [x1, y1, x2, y2] of edges) {
    const A = p.x - x1,
      B = p.y - y1,
      C = x2 - x1,
      D = y2 - y1
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let t = lenSq !== 0 ? dot / lenSq : 0
    t = clamp(t, 0, 1)
    const xx = x1 + t * C
    const yy = y1 + t * D
    best = Math.min(best, Math.hypot(p.x - xx, p.y - yy))
  }
  return best
}

/** Find the intersection of two 1D intervals, or null if they don't overlap. */
export function intersect1D(
  r1: [number, number],
  r2: [number, number],
) {
  const lo = Math.max(r1[0], r2[0])
  const hi = Math.min(r1[1], r2[1])
  return hi > lo + EPS ? ([lo, hi] as const) : null
}

/** Return A \ B as up to 4 non-overlapping rectangles (or [A] if no overlap). */
export function subtractRect2D(A: XYRect, B: XYRect): XYRect[] {
  if (!overlaps(A, B)) return [A]

  const Xi = intersect1D(
    [A.x, A.x + A.width],
    [B.x, B.x + B.width],
  )
  const Yi = intersect1D(
    [A.y, A.y + A.height],
    [B.y, B.y + B.height],
  )
  if (!Xi || !Yi) return [A]

  const [X0, X1] = Xi
  const [Y0, Y1] = Yi
  const out: XYRect[] = []

  // Left strip
  if (X0 > A.x + EPS) {
    out.push({ x: A.x, y: A.y, width: X0 - A.x, height: A.height })
  }
  // Right strip
  if (A.x + A.width > X1 + EPS) {
    out.push({ x: X1, y: A.y, width: A.x + A.width - X1, height: A.height })
  }
  // Top wedge in the middle band
  const midW = Math.max(0, X1 - X0)
  if (midW > EPS && Y0 > A.y + EPS) {
    out.push({ x: X0, y: A.y, width: midW, height: Y0 - A.y })
  }
  // Bottom wedge in the middle band
  if (midW > EPS && A.y + A.height > Y1 + EPS) {
    out.push({ x: X0, y: Y1, width: midW, height: A.y + A.height - Y1 })
  }

  return out.filter((r) => r.width > EPS && r.height > EPS)
}