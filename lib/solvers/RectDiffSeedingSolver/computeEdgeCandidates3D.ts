import type { Candidate3D, XYRect } from "../../rectdiff-types"
import { EPS, distancePointToRectEdges } from "../../utils/rectdiff-geometry"
import { isFullyOccupiedAtPoint } from "../../utils/isFullyOccupiedAtPoint"
import { longestFreeSpanAroundZ } from "./longestFreeSpanAroundZ"
import { isPointInPolygon } from "./isPointInPolygon"
import type RBush from "rbush"
import type { RTreeRect } from "lib/types/capacity-mesh-types"

/**
 * Compute exact uncovered segments along a 1D line.
 */
function computeUncoveredSegments(params: {
  lineStart: number
  lineEnd: number
  coveringIntervals: Array<{ start: number; end: number }>
  minSegmentLength: number
}): Array<{ start: number; end: number; center: number }> {
  const { lineStart, lineEnd, coveringIntervals, minSegmentLength } = params

  if (coveringIntervals.length === 0) {
    const center = (lineStart + lineEnd) / 2
    return [{ start: lineStart, end: lineEnd, center }]
  }

  // Sort intervals by start position
  const sorted = [...coveringIntervals].sort((a, b) => a.start - b.start)

  // Merge overlapping intervals
  const merged: Array<{ start: number; end: number }> = []
  let current = { ...sorted[0]! }

  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i]!
    if (interval.start <= current.end + EPS) {
      // Overlapping or adjacent - merge
      current.end = Math.max(current.end, interval.end)
    } else {
      // No overlap - save current and start new
      merged.push(current)
      current = { ...interval }
    }
  }
  merged.push(current)

  // Find gaps between merged intervals
  const uncovered: Array<{ start: number; end: number; center: number }> = []

  // Check gap before first interval
  if (merged[0]!.start > lineStart + EPS) {
    const start = lineStart
    const end = merged[0]!.start
    if (end - start >= minSegmentLength) {
      uncovered.push({ start, end, center: (start + end) / 2 })
    }
  }

  // Check gaps between intervals
  for (let i = 0; i < merged.length - 1; i++) {
    const start = merged[i]!.end
    const end = merged[i + 1]!.start
    if (end - start >= minSegmentLength) {
      uncovered.push({ start, end, center: (start + end) / 2 })
    }
  }

  // Check gap after last interval
  if (merged[merged.length - 1]!.end < lineEnd - EPS) {
    const start = merged[merged.length - 1]!.end
    const end = lineEnd
    if (end - start >= minSegmentLength) {
      uncovered.push({ start, end, center: (start + end) / 2 })
    }
  }

  return uncovered
}

/**
 * Compute edge candidates using exact edge analysis.
 */
export function computeEdgeCandidates3D(params: {
  bounds: XYRect
  minSize: number
  layerCount: number
  obstacleIndexByLayer: Array<RBush<RTreeRect> | undefined>
  placedIndexByLayer: Array<RBush<RTreeRect> | undefined>
  hardPlacedByLayer: XYRect[][]
  outline?: Array<{ x: number; y: number }>
}): Candidate3D[] {
  const {
    bounds,
    minSize,
    layerCount,
    obstacleIndexByLayer,
    placedIndexByLayer,
    hardPlacedByLayer,
    outline,
  } = params

  const out: Candidate3D[] = []
  // Use small inset from edges for placement
  const δ = Math.max(minSize * 0.15, EPS * 3)
  const dedup = new Set<string>()
  const key = (p: { x: number; y: number; z: number }) =>
    `${p.z}|${p.x.toFixed(6)}|${p.y.toFixed(6)}`

  function fullyOcc(p: { x: number; y: number }) {
    return isFullyOccupiedAtPoint({
      layerCount,
      obstacleIndexByLayer,
      placedIndexByLayer,
      point: p,
    })
  }

  function pushIfFree(p: { x: number; y: number; z: number }) {
    const { x, y, z } = p
    if (
      x < bounds.x + EPS ||
      y < bounds.y + EPS ||
      x > bounds.x + bounds.width - EPS ||
      y > bounds.y + bounds.height - EPS
    )
      return
    if (outline && outline.length > 2) {
      if (!isPointInPolygon({ x, y }, outline)) {
        return
      }
    }
    if (fullyOcc({ x, y })) return // new rule: only drop if truly impossible

    // Distance uses obstacles + hard nodes (soft nodes ignored for ranking)
    const hard = [
      ...(obstacleIndexByLayer[z]?.all() ?? []),
      ...(hardPlacedByLayer[z] ?? []),
    ]
    const d = Math.min(
      distancePointToRectEdges({ x, y }, bounds),
      ...(hard.length
        ? hard.map((b) => distancePointToRectEdges({ x, y }, b))
        : [Infinity]),
    )

    const k = key({ x, y, z })
    if (dedup.has(k)) return
    dedup.add(k)

    // Approximate z-span strength at this z (ignoring soft nodes)
    const span = longestFreeSpanAroundZ({
      x,
      y,
      z,
      layerCount,
      minSpan: 1,
      maxSpan: undefined,
      obstacleIndexByLayer,
      additionalBlockersByLayer: hardPlacedByLayer,
    })
    out.push({ x, y, z, distance: d, zSpanLen: span.length, isEdgeSeed: true })
  }

  for (let z = 0; z < layerCount; z++) {
    const blockers = [
      ...(obstacleIndexByLayer[z]?.all() ?? []),
      ...(hardPlacedByLayer[z] ?? []),
    ]

    // 1) Board edges — find exact uncovered segments along each edge

    // First, check corners explicitly
    const corners = [
      { x: bounds.x + δ, y: bounds.y + δ }, // top-left
      { x: bounds.x + bounds.width - δ, y: bounds.y + δ }, // top-right
      { x: bounds.x + δ, y: bounds.y + bounds.height - δ }, // bottom-left
      { x: bounds.x + bounds.width - δ, y: bounds.y + bounds.height - δ }, // bottom-right
    ]
    for (const corner of corners) {
      pushIfFree({ x: corner.x, y: corner.y, z })
    }

    // Top edge (y = bounds.y + δ)
    const topY = bounds.y + δ
    const topCovering = blockers
      .filter((b) => b.y <= topY && b.y + b.height >= topY)
      .map((b) => ({
        start: Math.max(bounds.x, b.x),
        end: Math.min(bounds.x + bounds.width, b.x + b.width),
      }))
    // Find uncovered segments that are large enough to potentially fill
    const topUncovered = computeUncoveredSegments({
      lineStart: bounds.x + δ,
      lineEnd: bounds.x + bounds.width - δ,
      coveringIntervals: topCovering,
      minSegmentLength: minSize * 0.5,
    })
    for (const seg of topUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        // Seed center and a few strategic points
        pushIfFree({ x: seg.center, y: topY, z })
        if (segLen > minSize * 1.5) {
          pushIfFree({ x: seg.start + minSize * 0.4, y: topY, z })
          pushIfFree({ x: seg.end - minSize * 0.4, y: topY, z })
        }
      }
    }

    // Bottom edge (y = bounds.y + bounds.height - δ)
    const bottomY = bounds.y + bounds.height - δ
    const bottomCovering = blockers
      .filter((b) => b.y <= bottomY && b.y + b.height >= bottomY)
      .map((b) => ({
        start: Math.max(bounds.x, b.x),
        end: Math.min(bounds.x + bounds.width, b.x + b.width),
      }))
    const bottomUncovered = computeUncoveredSegments({
      lineStart: bounds.x + δ,
      lineEnd: bounds.x + bounds.width - δ,
      coveringIntervals: bottomCovering,
      minSegmentLength: minSize * 0.5,
    })
    for (const seg of bottomUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        pushIfFree({ x: seg.center, y: bottomY, z })
        if (segLen > minSize * 1.5) {
          pushIfFree({ x: seg.start + minSize * 0.4, y: bottomY, z })
          pushIfFree({ x: seg.end - minSize * 0.4, y: bottomY, z })
        }
      }
    }

    // Left edge (x = bounds.x + δ)
    const leftX = bounds.x + δ
    const leftCovering = blockers
      .filter((b) => b.x <= leftX && b.x + b.width >= leftX)
      .map((b) => ({
        start: Math.max(bounds.y, b.y),
        end: Math.min(bounds.y + bounds.height, b.y + b.height),
      }))
    const leftUncovered = computeUncoveredSegments({
      lineStart: bounds.y + δ,
      lineEnd: bounds.y + bounds.height - δ,
      coveringIntervals: leftCovering,
      minSegmentLength: minSize * 0.5,
    })
    for (const seg of leftUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        pushIfFree({ x: leftX, y: seg.center, z })
        if (segLen > minSize * 1.5) {
          pushIfFree({ x: leftX, y: seg.start + minSize * 0.4, z })
          pushIfFree({ x: leftX, y: seg.end - minSize * 0.4, z })
        }
      }
    }

    // Right edge (x = bounds.x + bounds.width - δ)
    const rightX = bounds.x + bounds.width - δ
    const rightCovering = blockers
      .filter((b) => b.x <= rightX && b.x + b.width >= rightX)
      .map((b) => ({
        start: Math.max(bounds.y, b.y),
        end: Math.min(bounds.y + bounds.height, b.y + b.height),
      }))
    const rightUncovered = computeUncoveredSegments({
      lineStart: bounds.y + δ,
      lineEnd: bounds.y + bounds.height - δ,
      coveringIntervals: rightCovering,
      minSegmentLength: minSize * 0.5,
    })
    for (const seg of rightUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        pushIfFree({ x: rightX, y: seg.center, z })
        if (segLen > minSize * 1.5) {
          pushIfFree({ x: rightX, y: seg.start + minSize * 0.4, z })
          pushIfFree({ x: rightX, y: seg.end - minSize * 0.4, z })
        }
      }
    }

    // 2) Around every obstacle and placed rect edge — find exact uncovered segments
    for (const b of blockers) {
      // Left edge of blocker (x = b.x - δ)
      const obLeftX = b.x - δ
      if (obLeftX > bounds.x + EPS && obLeftX < bounds.x + bounds.width - EPS) {
        const obLeftCovering = blockers
          .filter(
            (bl) => bl !== b && bl.x <= obLeftX && bl.x + bl.width >= obLeftX,
          )
          .map((bl) => ({
            start: Math.max(b.y, bl.y),
            end: Math.min(b.y + b.height, bl.y + bl.height),
          }))
        const obLeftUncovered = computeUncoveredSegments({
          lineStart: b.y,
          lineEnd: b.y + b.height,
          coveringIntervals: obLeftCovering,
          minSegmentLength: minSize * 0.5,
        })
        for (const seg of obLeftUncovered) {
          pushIfFree({ x: obLeftX, y: seg.center, z })
        }
      }

      // Right edge of blocker (x = b.x + b.width + δ)
      const obRightX = b.x + b.width + δ
      if (
        obRightX > bounds.x + EPS &&
        obRightX < bounds.x + bounds.width - EPS
      ) {
        const obRightCovering = blockers
          .filter(
            (bl) => bl !== b && bl.x <= obRightX && bl.x + bl.width >= obRightX,
          )
          .map((bl) => ({
            start: Math.max(b.y, bl.y),
            end: Math.min(b.y + b.height, bl.y + bl.height),
          }))
        const obRightUncovered = computeUncoveredSegments({
          lineStart: b.y,
          lineEnd: b.y + b.height,
          coveringIntervals: obRightCovering,
          minSegmentLength: minSize * 0.5,
        })
        for (const seg of obRightUncovered) {
          pushIfFree({ x: obRightX, y: seg.center, z })
        }
      }

      // Top edge of blocker (y = b.y - δ)
      const obTopY = b.y - δ
      if (obTopY > bounds.y + EPS && obTopY < bounds.y + bounds.height - EPS) {
        const obTopCovering = blockers
          .filter(
            (bl) => bl !== b && bl.y <= obTopY && bl.y + bl.height >= obTopY,
          )
          .map((bl) => ({
            start: Math.max(b.x, bl.x),
            end: Math.min(b.x + b.width, bl.x + bl.width),
          }))
        const obTopUncovered = computeUncoveredSegments({
          lineStart: b.x,
          lineEnd: b.x + b.width,
          coveringIntervals: obTopCovering,
          minSegmentLength: minSize * 0.5,
        })
        for (const seg of obTopUncovered) {
          pushIfFree({ x: seg.center, y: obTopY, z })
        }
      }

      // Bottom edge of blocker (y = b.y + b.height + δ)
      const obBottomY = b.y + b.height + δ
      if (
        obBottomY > bounds.y + EPS &&
        obBottomY < bounds.y + bounds.height - EPS
      ) {
        const obBottomCovering = blockers
          .filter(
            (bl) =>
              bl !== b && bl.y <= obBottomY && bl.y + bl.height >= obBottomY,
          )
          .map((bl) => ({
            start: Math.max(b.x, bl.x),
            end: Math.min(b.x + b.width, bl.x + bl.width),
          }))
        const obBottomUncovered = computeUncoveredSegments({
          lineStart: b.x,
          lineEnd: b.x + b.width,
          coveringIntervals: obBottomCovering,
          minSegmentLength: minSize * 0.5,
        })
        for (const seg of obBottomUncovered) {
          pushIfFree({ x: seg.center, y: obBottomY, z })
        }
      }
    }
  }

  // Strong multi-layer preference then distance.
  out.sort((a, b) => b.zSpanLen! - a.zSpanLen! || b.distance - a.distance)
  return out
}
