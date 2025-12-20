import type { SegmentWithAdjacentEmptySpace } from "./FindSegmentsWithAdjacentEmptySpaceSolver"

const EPS = 1e-4

export function projectToUncoveredSegments(
  primaryEdge: SegmentWithAdjacentEmptySpace,
  overlappingEdges: SegmentWithAdjacentEmptySpace[],
): Array<SegmentWithAdjacentEmptySpace> {
  const isHorizontal = Math.abs(primaryEdge.start.y - primaryEdge.end.y) < EPS
  const isVertical = Math.abs(primaryEdge.start.x - primaryEdge.end.x) < EPS
  if (!isHorizontal && !isVertical) return []

  const axis: "x" | "y" = isHorizontal ? "x" : "y"
  const perp: "x" | "y" = isHorizontal ? "y" : "x"
  const lineCoord = primaryEdge.start[perp]

  const p0 = primaryEdge.start[axis]
  const p1 = primaryEdge.end[axis]
  const pMin = Math.min(p0, p1)
  const pMax = Math.max(p0, p1)

  const clamp = (v: number) => Math.max(pMin, Math.min(pMax, v))

  // 1) project each overlapping edge to an interval on the primary edge
  const intervals: Array<{ s: number; e: number }> = []
  for (const e of overlappingEdges) {
    if (e === primaryEdge) continue

    // only consider edges parallel + colinear (within EPS) with the primary edge
    const eIsHorizontal = Math.abs(e.start.y - e.end.y) < EPS
    const eIsVertical = Math.abs(e.start.x - e.end.x) < EPS
    if (axis === "x" && !eIsHorizontal) continue
    if (axis === "y" && !eIsVertical) continue
    if (Math.abs(e.start[perp] - lineCoord) > EPS) continue

    const eMin = Math.min(e.start[axis], e.end[axis])
    const eMax = Math.max(e.start[axis], e.end[axis])

    const s = clamp(eMin)
    const t = clamp(eMax)
    if (t - s > EPS) intervals.push({ s, e: t })
  }

  if (intervals.length === 0) {
    // nothing covers the primary edge -> entire edge is uncovered
    return [
      {
        ...primaryEdge,
        start: { ...primaryEdge.start },
        end: { ...primaryEdge.end },
      },
    ]
  }

  // 2) merge cover intervals
  intervals.sort((a, b) => a.s - b.s)
  const merged: Array<{ s: number; e: number }> = []
  for (const it of intervals) {
    const last = merged[merged.length - 1]
    if (!last || it.s > last.e + EPS) merged.push({ ...it })
    else last.e = Math.max(last.e, it.e)
  }

  // 3) compute uncovered intervals (complement of merged within [pMin,pMax])
  const uncovered: Array<{ s: number; e: number }> = []
  let cursor = pMin
  for (const m of merged) {
    if (m.s > cursor + EPS) uncovered.push({ s: cursor, e: m.s })
    cursor = Math.max(cursor, m.e)
    if (cursor >= pMax - EPS) break
  }
  if (pMax > cursor + EPS) uncovered.push({ s: cursor, e: pMax })
  if (uncovered.length === 0) return []

  // 4) convert uncovered intervals back to segments on the primary edge
  return uncovered
    .filter((u) => u.e - u.s > EPS)
    .map((u) => {
      const start =
        axis === "x" ? { x: u.s, y: lineCoord } : { x: lineCoord, y: u.s }
      const end =
        axis === "x" ? { x: u.e, y: lineCoord } : { x: lineCoord, y: u.e }

      return {
        parent: primaryEdge.parent,
        facingDirection: primaryEdge.facingDirection,
        start,
        end,
        z: primaryEdge.z,
      }
    })
}
