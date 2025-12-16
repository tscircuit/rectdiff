// lib/solvers/rectdiff/candidates.ts
import type { Candidate3D, XYRect } from "./types"
import { EPS, clamp, containsPoint, distancePointToRectEdges } from "./geometry"

/**
 * Check if a point is occupied on all layers.
 */
function isFullyOccupiedAllLayers(params: {
  x: number
  y: number
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
}): boolean {
  const { x, y, layerCount, obstaclesByLayer, placedByLayer } = params
  for (let z = 0; z < layerCount; z++) {
    const obs = obstaclesByLayer[z] ?? []
    const placed = placedByLayer[z] ?? []
    const occ =
      obs.some((b) => containsPoint(b, x, y)) ||
      placed.some((b) => containsPoint(b, x, y))
    if (!occ) return false
  }
  return true
}

/**
 * Compute candidate seed points for a given grid size.
 */
export function computeCandidates3D(params: {
  bounds: XYRect
  gridSize: number
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
  hardPlacedByLayer: XYRect[][]
}): Candidate3D[] {
  const {
    bounds,
    gridSize,
    layerCount,
    obstaclesByLayer,
    placedByLayer,
    hardPlacedByLayer,
  } = params
  const out = new Map<string, Candidate3D>() // key by (x,y)

  for (let x = bounds.x; x < bounds.x + bounds.width; x += gridSize) {
    for (let y = bounds.y; y < bounds.y + bounds.height; y += gridSize) {
      // Skip outermost row/col (stable with prior behavior)
      if (
        Math.abs(x - bounds.x) < EPS ||
        Math.abs(y - bounds.y) < EPS ||
        x > bounds.x + bounds.width - gridSize - EPS ||
        y > bounds.y + bounds.height - gridSize - EPS
      ) {
        continue
      }

      // New rule: Only drop if EVERY layer is occupied (by obstacle or node)
      if (
        isFullyOccupiedAllLayers({
          x,
          y,
          layerCount,
          obstaclesByLayer,
          placedByLayer,
        })
      )
        continue

      // Find the best (longest) free contiguous Z span at (x,y) ignoring soft nodes.
      let bestSpan: number[] = []
      let bestZ = 0
      for (let z = 0; z < layerCount; z++) {
        const s = longestFreeSpanAroundZ({
          x,
          y,
          z,
          layerCount,
          minSpan: 1,
          maxSpan: undefined,
          obstaclesByLayer,
          placedByLayer: hardPlacedByLayer,
        })
        if (s.length > bestSpan.length) {
          bestSpan = s
          bestZ = z
        }
      }
      const anchorZ = bestSpan.length
        ? bestSpan[Math.floor(bestSpan.length / 2)]!
        : bestZ

      // Distance heuristic against hard blockers only (obstacles + full-stack)
      const hardAtZ = [
        ...(obstaclesByLayer[anchorZ] ?? []),
        ...(hardPlacedByLayer[anchorZ] ?? []),
      ]
      const d = Math.min(
        distancePointToRectEdges(x, y, bounds),
        ...(hardAtZ.length
          ? hardAtZ.map((b) => distancePointToRectEdges(x, y, b))
          : [Infinity]),
      )

      const k = `${x.toFixed(6)}|${y.toFixed(6)}`
      const cand: Candidate3D = {
        x,
        y,
        z: anchorZ,
        distance: d,
        zSpanLen: bestSpan.length,
      }
      const prev = out.get(k)
      if (
        !prev ||
        cand.zSpanLen! > (prev.zSpanLen ?? 0) ||
        (cand.zSpanLen === prev.zSpanLen && cand.distance > prev.distance)
      ) {
        out.set(k, cand)
      }
    }
  }

  const arr = Array.from(out.values())
  arr.sort((a, b) => b.zSpanLen! - a.zSpanLen! || b.distance - a.distance)
  return arr
}

/**
 * Find the longest contiguous free span around z (optionally capped).
 */
export function longestFreeSpanAroundZ(params: {
  x: number
  y: number
  z: number
  layerCount: number
  minSpan: number
  maxSpan: number | undefined
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
}): number[] {
  const {
    x,
    y,
    z,
    layerCount,
    minSpan,
    maxSpan,
    obstaclesByLayer,
    placedByLayer,
  } = params

  const isFreeAt = (layer: number) => {
    const blockers = [
      ...(obstaclesByLayer[layer] ?? []),
      ...(placedByLayer[layer] ?? []),
    ]
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

/**
 * Compute default grid sizes based on bounds.
 */
export function computeDefaultGridSizes(bounds: XYRect): number[] {
  const ref = Math.max(bounds.width, bounds.height)
  return [ref / 32]
}

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
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
  hardPlacedByLayer: XYRect[][]
}): Candidate3D[] {
  const {
    bounds,
    minSize,
    layerCount,
    obstaclesByLayer,
    placedByLayer,
    hardPlacedByLayer,
  } = params

  const out: Candidate3D[] = []
  // Use small inset from edges for placement
  const δ = Math.max(minSize * 0.15, EPS * 3)
  const dedup = new Set<string>()
  const key = (x: number, y: number, z: number) =>
    `${z}|${x.toFixed(6)}|${y.toFixed(6)}`

  function fullyOcc(x: number, y: number) {
    return isFullyOccupiedAllLayers({
      x,
      y,
      layerCount,
      obstaclesByLayer,
      placedByLayer,
    })
  }

  function pushIfFree(x: number, y: number, z: number) {
    if (
      x < bounds.x + EPS ||
      y < bounds.y + EPS ||
      x > bounds.x + bounds.width - EPS ||
      y > bounds.y + bounds.height - EPS
    )
      return
    if (fullyOcc(x, y)) return // new rule: only drop if truly impossible

    // Distance uses obstacles + hard nodes (soft nodes ignored for ranking)
    const hard = [
      ...(obstaclesByLayer[z] ?? []),
      ...(hardPlacedByLayer[z] ?? []),
    ]
    const d = Math.min(
      distancePointToRectEdges(x, y, bounds),
      ...(hard.length
        ? hard.map((b) => distancePointToRectEdges(x, y, b))
        : [Infinity]),
    )

    const k = key(x, y, z)
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
      obstaclesByLayer,
      placedByLayer: hardPlacedByLayer,
    })
    out.push({ x, y, z, distance: d, zSpanLen: span.length, isEdgeSeed: true })
  }

  for (let z = 0; z < layerCount; z++) {
    const blockers = [
      ...(obstaclesByLayer[z] ?? []),
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
      pushIfFree(corner.x, corner.y, z)
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
          pushIfFree(obLeftX, seg.center, z)
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
          pushIfFree(obRightX, seg.center, z)
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
          pushIfFree(seg.center, obTopY, z)
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
          pushIfFree(seg.center, obBottomY, z)
        }
      }
    }
  }

  // Strong multi-layer preference then distance.
  out.sort((a, b) => b.zSpanLen! - a.zSpanLen! || b.distance - a.distance)
  return out
}
