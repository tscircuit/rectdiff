// lib/solvers/rectdiff/candidates.ts
import type { Candidate3D, XYRect } from "./types"
import { EPS, containsPoint, distancePointToRectEdges, clamp } from "./geometry"

export function computeCandidates3D(
  bounds: XYRect,
  gridSize: number,
  layerCount: number,
  obstaclesByLayer: XYRect[][],
  placedByLayer: XYRect[][],
): Candidate3D[] {
  const out: Candidate3D[] = []

  for (let z = 0; z < layerCount; z++) {
    const blockers = [...(obstaclesByLayer[z] ?? []), ...(placedByLayer[z] ?? [])]

    for (let x = bounds.x; x < bounds.x + bounds.width; x += gridSize) {
      for (let y = bounds.y; y < bounds.y + bounds.height; y += gridSize) {
        // avoid seeding on the outermost row/col
        if (
          Math.abs(x - bounds.x) < EPS ||
          Math.abs(y - bounds.y) < EPS ||
          x > bounds.x + bounds.width - gridSize - EPS ||
          y > bounds.y + bounds.height - gridSize - EPS
        ) {
          continue
        }

        let inside = false
        for (const b of blockers) {
          if (containsPoint(b, x, y)) {
            inside = true
            const bottom = b.y + b.height
            const remain = bottom - y
            const skip = Math.max(0, Math.floor(remain / gridSize))
            if (skip > 0) y += (skip - 1) * gridSize
            break
          }
        }
        if (inside) continue

        const d = Math.min(
          distancePointToRectEdges(x, y, bounds),
          ...(blockers.length ? blockers.map((b) => distancePointToRectEdges(x, y, b)) : [Infinity]),
        )
        // Prefer seeds that can span many Z layers at this (x,y)
        const span = longestFreeSpanAroundZ(
          x, y, z, layerCount, 1, undefined, obstaclesByLayer, placedByLayer
        )
        out.push({ x, y, z, distance: d, zSpanLen: span.length })
      }
    }
  }

  // Sort by multi-layer opportunity first, then by clearance from blockers.
  out.sort((a, b) => (b.zSpanLen! - a.zSpanLen!) || (b.distance - a.distance))
  return out
}

/** Longest contiguous free span around z (optionally capped) */
export function longestFreeSpanAroundZ(
  x: number,
  y: number,
  z: number,
  layerCount: number,
  minSpan: number,
  maxSpan: number | undefined,
  obstaclesByLayer: XYRect[][],
  placedByLayer: XYRect[][],
): number[] {
  const isFreeAt = (layer: number) => {
    const blockers = [...(obstaclesByLayer[layer] ?? []), ...(placedByLayer[layer] ?? [])]
    return !blockers.some((b) => containsPoint(b, x, y))
  }
  let lo = z
  let hi = z
  while (lo - 1 >= 0 && isFreeAt(lo - 1)) lo--
  while (hi + 1 < layerCount && isFreeAt(hi + 1)) hi++

  if (typeof maxSpan === "number") {
    const target = clamp(maxSpan, 1, layerCount)
    // trim symmetrically (keeping z inside)
    while (hi - lo + 1 > target) {
      if (z - lo > hi - z) lo++
      else hi--
    }
  }

  const res: number[] = []
  for (let i = lo; i <= hi; i++) res.push(i)
  return res.length >= minSpan ? res : []
}

export function computeDefaultGridSizes(bounds: XYRect): number[] {
  const ref = Math.max(bounds.width, bounds.height)
  return [ref / 8, ref / 16, ref / 32]
}

/** Compute exact uncovered segments along a 1D line given a list of covering intervals */
function computeUncoveredSegments(
  lineStart: number,
  lineEnd: number,
  coveringIntervals: Array<{ start: number; end: number }>,
  minSegmentLength: number,
): Array<{ start: number; end: number; center: number }> {
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

/** Exact edge analysis: find uncovered segments along board edges and blocker edges */
export function computeEdgeCandidates3D(
  bounds: XYRect,
  minSize: number,
  layerCount: number,
  obstaclesByLayer: XYRect[][],
  placedByLayer: XYRect[][],
): Candidate3D[] {
  const out: Candidate3D[] = []
  // Use small inset from edges for placement
  const δ = Math.max(minSize * 0.15, EPS * 3)
  const dedup = new Set<string>()
  const key = (x: number, y: number, z: number) => `${z}|${x.toFixed(6)}|${y.toFixed(6)}`

  function pushIfFree(x: number, y: number, z: number) {
    if (
      x < bounds.x + EPS || y < bounds.y + EPS ||
      x > bounds.x + bounds.width - EPS || y > bounds.y + bounds.height - EPS
    ) return
    const blockers = [...(obstaclesByLayer[z] ?? []), ...(placedByLayer[z] ?? [])]
    if (blockers.some((b) => containsPoint(b, x, y))) return
    const d = Math.min(
      distancePointToRectEdges(x, y, bounds),
      ...(blockers.length ? blockers.map((b) => distancePointToRectEdges(x, y, b)) : [Infinity]),
    )
    const span = longestFreeSpanAroundZ(
      x, y, z, layerCount, 1, undefined, obstaclesByLayer, placedByLayer
    )
    const k = key(x, y, z)
    if (dedup.has(k)) return
    dedup.add(k)
    out.push({ x, y, z, distance: d, zSpanLen: span.length, isEdgeSeed: true })
  }

  for (let z = 0; z < layerCount; z++) {
    const blockers = [...(obstaclesByLayer[z] ?? []), ...(placedByLayer[z] ?? [])]

    // 1) Board edges — find exact uncovered segments along each edge

    // First, check corners explicitly
    const corners = [
      { x: bounds.x + δ, y: bounds.y + δ }, // top-left
      { x: bounds.x + bounds.width - δ, y: bounds.y + δ }, // top-right
      { x: bounds.x + δ, y: bounds.y + bounds.height - δ }, // bottom-left
      { x: bounds.x + bounds.width - δ, y: bounds.y + bounds.height - δ }, // bottom-right
    ]
    for (const corner of corners) {
      pushIfFree(corner.x, corner.y, z)
    }

    // Top edge (y = bounds.y + δ)
    const topY = bounds.y + δ
    const topCovering = blockers
      .filter(b => b.y <= topY && b.y + b.height >= topY)
      .map(b => ({ start: Math.max(bounds.x, b.x), end: Math.min(bounds.x + bounds.width, b.x + b.width) }))
    // Find uncovered segments that are large enough to potentially fill
    const topUncovered = computeUncoveredSegments(bounds.x + δ, bounds.x + bounds.width - δ, topCovering, minSize * 0.5)
    for (const seg of topUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        // Seed center and a few strategic points
        pushIfFree(seg.center, topY, z)
        if (segLen > minSize * 1.5) {
          pushIfFree(seg.start + minSize * 0.4, topY, z)
          pushIfFree(seg.end - minSize * 0.4, topY, z)
        }
      }
    }

    // Bottom edge (y = bounds.y + bounds.height - δ)
    const bottomY = bounds.y + bounds.height - δ
    const bottomCovering = blockers
      .filter(b => b.y <= bottomY && b.y + b.height >= bottomY)
      .map(b => ({ start: Math.max(bounds.x, b.x), end: Math.min(bounds.x + bounds.width, b.x + b.width) }))
    const bottomUncovered = computeUncoveredSegments(bounds.x + δ, bounds.x + bounds.width - δ, bottomCovering, minSize * 0.5)
    for (const seg of bottomUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        pushIfFree(seg.center, bottomY, z)
        if (segLen > minSize * 1.5) {
          pushIfFree(seg.start + minSize * 0.4, bottomY, z)
          pushIfFree(seg.end - minSize * 0.4, bottomY, z)
        }
      }
    }

    // Left edge (x = bounds.x + δ)
    const leftX = bounds.x + δ
    const leftCovering = blockers
      .filter(b => b.x <= leftX && b.x + b.width >= leftX)
      .map(b => ({ start: Math.max(bounds.y, b.y), end: Math.min(bounds.y + bounds.height, b.y + b.height) }))
    const leftUncovered = computeUncoveredSegments(bounds.y + δ, bounds.y + bounds.height - δ, leftCovering, minSize * 0.5)
    for (const seg of leftUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        pushIfFree(leftX, seg.center, z)
        if (segLen > minSize * 1.5) {
          pushIfFree(leftX, seg.start + minSize * 0.4, z)
          pushIfFree(leftX, seg.end - minSize * 0.4, z)
        }
      }
    }

    // Right edge (x = bounds.x + bounds.width - δ)
    const rightX = bounds.x + bounds.width - δ
    const rightCovering = blockers
      .filter(b => b.x <= rightX && b.x + b.width >= rightX)
      .map(b => ({ start: Math.max(bounds.y, b.y), end: Math.min(bounds.y + bounds.height, b.y + b.height) }))
    const rightUncovered = computeUncoveredSegments(bounds.y + δ, bounds.y + bounds.height - δ, rightCovering, minSize * 0.5)
    for (const seg of rightUncovered) {
      const segLen = seg.end - seg.start
      if (segLen >= minSize) {
        pushIfFree(rightX, seg.center, z)
        if (segLen > minSize * 1.5) {
          pushIfFree(rightX, seg.start + minSize * 0.4, z)
          pushIfFree(rightX, seg.end - minSize * 0.4, z)
        }
      }
    }

    // 2) Around every obstacle and placed rect edge — find exact uncovered segments
    for (const b of blockers) {
      // Left edge of blocker (x = b.x - δ)
      const obLeftX = b.x - δ
      if (obLeftX > bounds.x + EPS && obLeftX < bounds.x + bounds.width - EPS) {
        const obLeftCovering = blockers
          .filter(bl => bl !== b && bl.x <= obLeftX && bl.x + bl.width >= obLeftX)
          .map(bl => ({ start: Math.max(b.y, bl.y), end: Math.min(b.y + b.height, bl.y + bl.height) }))
        const obLeftUncovered = computeUncoveredSegments(b.y, b.y + b.height, obLeftCovering, minSize * 0.5)
        for (const seg of obLeftUncovered) {
          pushIfFree(obLeftX, seg.center, z)
        }
      }

      // Right edge of blocker (x = b.x + b.width + δ)
      const obRightX = b.x + b.width + δ
      if (obRightX > bounds.x + EPS && obRightX < bounds.x + bounds.width - EPS) {
        const obRightCovering = blockers
          .filter(bl => bl !== b && bl.x <= obRightX && bl.x + bl.width >= obRightX)
          .map(bl => ({ start: Math.max(b.y, bl.y), end: Math.min(b.y + b.height, bl.y + bl.height) }))
        const obRightUncovered = computeUncoveredSegments(b.y, b.y + b.height, obRightCovering, minSize * 0.5)
        for (const seg of obRightUncovered) {
          pushIfFree(obRightX, seg.center, z)
        }
      }

      // Top edge of blocker (y = b.y - δ)
      const obTopY = b.y - δ
      if (obTopY > bounds.y + EPS && obTopY < bounds.y + bounds.height - EPS) {
        const obTopCovering = blockers
          .filter(bl => bl !== b && bl.y <= obTopY && bl.y + bl.height >= obTopY)
          .map(bl => ({ start: Math.max(b.x, bl.x), end: Math.min(b.x + b.width, bl.x + bl.width) }))
        const obTopUncovered = computeUncoveredSegments(b.x, b.x + b.width, obTopCovering, minSize * 0.5)
        for (const seg of obTopUncovered) {
          pushIfFree(seg.center, obTopY, z)
        }
      }

      // Bottom edge of blocker (y = b.y + b.height + δ)
      const obBottomY = b.y + b.height + δ
      if (obBottomY > bounds.y + EPS && obBottomY < bounds.y + bounds.height - EPS) {
        const obBottomCovering = blockers
          .filter(bl => bl !== b && bl.y <= obBottomY && bl.y + bl.height >= obBottomY)
          .map(bl => ({ start: Math.max(b.x, bl.x), end: Math.min(b.x + b.width, bl.x + bl.width) }))
        const obBottomUncovered = computeUncoveredSegments(b.x, b.x + b.width, obBottomCovering, minSize * 0.5)
        for (const seg of obBottomUncovered) {
          pushIfFree(seg.center, obBottomY, z)
        }
      }
    }
  }

  // Strong multi-layer preference then distance.
  out.sort((a, b) => (b.zSpanLen! - a.zSpanLen!) || (b.distance - a.distance))
  return out
}
