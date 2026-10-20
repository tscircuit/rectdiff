import type { Candidate3D, XYRect } from "../../rectdiff-types"
import { EPS, distancePointToRectEdges } from "../../utils/rectdiff-geometry"
import { isFullyOccupiedAtPoint } from "../../utils/isFullyOccupiedAtPoint"
import { longestFreeSpanAroundZ } from "./longestFreeSpanAroundZ"
import type RBush from "rbush"
import Flatbush from "flatbush"
import type { RTreeRect } from "../../types/capacity-mesh-types"
const quantize = (value: number, precision = 1e-6) =>
  Math.round(value / precision) * precision

const toRect = (rect: XYRect | RTreeRect): XYRect =>
  "minX" in rect
    ? {
        x: rect.minX,
        y: rect.minY,
        width: rect.maxX - rect.minX,
        height: rect.maxY - rect.minY,
      }
    : rect

type ProjectedBlocker = {
  start: number
  end: number
  sourceIndex: number
}

type EdgeBounds = {
  lineStart: number
  lineEnd: number
  clipStart: number
  clipEnd: number
  sourceIndex?: number
}

/**
 * Project sorted blocker intervals onto an edge, preserving the original
 * normalization of clipped intervals outside that edge.
 */
function computeUncoveredSegments(params: {
  segment: EdgeBounds
  coveringIntervals: ProjectedBlocker[]
  hasReversedIntervals: boolean
  minSegmentLength: number
}): Array<{ start: number; end: number; center: number }> {
  const { segment, coveringIntervals, hasReversedIntervals, minSegmentLength } =
    params
  const lineStartQ = quantize(segment.lineStart)
  const lineEndQ = quantize(segment.lineEnd)
  const clipStartQ = quantize(segment.clipStart)
  const clipEndQ = quantize(segment.clipEnd)
  let normalizedIntervals: Array<{ start: number; end: number }> = []

  if (hasReversedIntervals || clipStartQ > clipEndQ) {
    // Reversed extents have no monotonic projection; retain the general
    // normalization and ordering used by the exhaustive implementation.
    normalizedIntervals = coveringIntervals
      .filter((interval) => interval.sourceIndex !== segment.sourceIndex)
      .map((interval) => {
        const start = Math.max(clipStartQ, interval.start)
        const end = Math.min(clipEndQ, interval.end)
        return { start: Math.min(start, end), end: Math.max(start, end) }
      })
      .filter((interval) => interval.end > interval.start + EPS)
      .sort((a, b) => a.start - b.start)
  } else {
    let beforeStart = Infinity
    let afterEnd = -Infinity
    for (const interval of coveringIntervals) {
      if (interval.sourceIndex === segment.sourceIndex) continue
      const start = Math.max(clipStartQ, interval.start)
      const end = Math.min(clipEndQ, interval.end)
      if (end < start) {
        // A disjoint clipped interval is reversed by the original algorithm.
        // All intervals before the edge share clipStartQ as their end;
        // all intervals after it share clipEndQ as their start.
        if (interval.end < clipStartQ) {
          beforeStart = Math.min(beforeStart, end)
        } else {
          afterEnd = Math.max(afterEnd, start)
        }
      } else if (end > start + EPS) {
        // Clipping preserves start order for overlapping intervals.
        normalizedIntervals.push({ start, end })
      }
    }
    if (clipStartQ > beforeStart + EPS) {
      normalizedIntervals.unshift({ start: beforeStart, end: clipStartQ })
    }
    if (afterEnd > clipEndQ + EPS) {
      normalizedIntervals.push({ start: clipEndQ, end: afterEnd })
    }
  }

  if (normalizedIntervals.length === 0) {
    const center = (lineStartQ + lineEndQ) / 2
    return [{ start: lineStartQ, end: lineEndQ, center }]
  }

  const uncovered: Array<{ start: number; end: number; center: number }> = []
  const currentStart = normalizedIntervals[0]!.start
  let currentEnd = normalizedIntervals[0]!.end
  if (
    currentStart > lineStartQ + EPS &&
    currentStart - lineStartQ >= minSegmentLength
  ) {
    uncovered.push({
      start: lineStartQ,
      end: currentStart,
      center: (lineStartQ + currentStart) / 2,
    })
  }
  for (let i = 1; i < normalizedIntervals.length; i++) {
    const interval = normalizedIntervals[i]!
    if (interval.start <= currentEnd + EPS) {
      currentEnd = Math.max(currentEnd, interval.end)
    } else {
      if (interval.start - currentEnd >= minSegmentLength) {
        uncovered.push({
          start: currentEnd,
          end: interval.start,
          center: (currentEnd + interval.start) / 2,
        })
      }
      currentEnd = interval.end
    }
  }
  if (
    currentEnd < lineEndQ - EPS &&
    lineEndQ - currentEnd >= minSegmentLength
  ) {
    uncovered.push({
      start: currentEnd,
      end: lineEndQ,
      center: (currentEnd + lineEndQ) / 2,
    })
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
}): Candidate3D[] {
  const {
    bounds,
    minSize,
    layerCount,
    obstacleIndexByLayer,
    placedIndexByLayer,
    hardPlacedByLayer,
  } = params

  const out: Candidate3D[] = []
  // Use small inset from edges for placement
  const δ = Math.max(minSize * 0.15, EPS * 3)
  const edgesPerAxis = 2
  const edgesPerRectangle = 4
  let nextOrder = 0
  const acceptedSeeds = new Map<
    string,
    { x: number; y: number; z: number; order: number; pointOrder: number }
  >()
  const hardRectsByLayer = Array.from({ length: layerCount }, (_, z) =>
    [
      ...(obstacleIndexByLayer[z]?.all() ?? []),
      ...(hardPlacedByLayer[z] ?? []),
    ].map(toRect),
  )
  // Ranking measures the original rectangle edges, before line-test rounding.
  const hardRectIndexByLayer = hardRectsByLayer.map((rects) => {
    if (rects.length === 0) return null
    const index = new Flatbush(rects.length)
    for (const rect of rects) {
      const endX = rect.x + rect.width
      const endY = rect.y + rect.height
      // The index needs ordered bounds, including for reversed extents.
      // Exact ranking still uses the original rectangle and distance helper.
      index.add(
        Math.min(rect.x, endX),
        Math.min(rect.y, endY),
        Math.max(rect.x, endX),
        Math.max(rect.y, endY),
      )
    }
    index.finish()
    return index
  })
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

  function pushIfFree(p: {
    x: number
    y: number
    z: number
    order: number
    pointOrder: number
  }) {
    const qx = quantize(p.x)
    const qy = quantize(p.y)
    const { z } = p
    const x = qx
    const y = qy
    if (
      x < bounds.x + EPS ||
      y < bounds.y + EPS ||
      x > bounds.x + bounds.width - EPS ||
      y > bounds.y + bounds.height - EPS
    )
      return
    const k = key({ x, y, z })
    const previous = acceptedSeeds.get(k)
    if (
      previous &&
      (previous.order < p.order ||
        (previous.order === p.order && previous.pointOrder <= p.pointOrder))
    )
      return
    if (fullyOcc({ x, y })) return
    // Grouped lines run out of source order. Keep the first accepted point in
    // the original order, including its exact quantized float representation.
    acceptedSeeds.set(k, { x, y, z, order: p.order, pointOrder: p.pointOrder })
  }

  for (let z = 0; z < layerCount; z++) {
    const blockers = (hardRectsByLayer[z] ?? []).map((b) => ({
      x: quantize(b.x),
      y: quantize(b.y),
      width: quantize(b.width),
      height: quantize(b.height),
    }))

    // Query quantized blockers on the full line. Clipping a disjoint
    // interval can reverse its endpoints, so the query must remain unbounded.
    const blockerIndex =
      blockers.length > 0 ? new Flatbush(blockers.length) : null
    if (blockerIndex) {
      for (const blocker of blockers) {
        blockerIndex.add(
          blocker.x,
          blocker.y,
          blocker.x + blocker.width,
          blocker.y + blocker.height,
        )
      }
      blockerIndex.finish()
    }

    // Group only query descriptions, not their hits: retained memory is linear
    // in the number of edges, even when every line crosses every blocker.
    const verticalLines = new Map<number, number[]>()
    const horizontalLines = new Map<number, number[]>()
    const addLine = (params: {
      vertical: boolean
      coordinate: number
      edgeOrdinal: number
    }) => {
      const lines = params.vertical ? verticalLines : horizontalLines
      const segments = lines.get(params.coordinate)
      if (segments) segments.push(params.edgeOrdinal)
      else lines.set(params.coordinate, [params.edgeOrdinal])
    }

    // These ordinals follow the original walk: four corners, four board
    // edges, then left/right/top/bottom for each blocker. Reserve each edge's
    // slot even when it lies outside the board, so its source remains derivable.
    const layerOrder = nextOrder
    let nextEdgeOrdinal = 0

    const corners = [
      { x: bounds.x + δ, y: bounds.y + δ },
      { x: bounds.x + bounds.width - δ, y: bounds.y + δ },
      { x: bounds.x + δ, y: bounds.y + bounds.height - δ },
      { x: bounds.x + bounds.width - δ, y: bounds.y + bounds.height - δ },
    ]
    for (const corner of corners) {
      pushIfFree({
        ...corner,
        z,
        order: layerOrder + nextEdgeOrdinal++,
        pointOrder: 0,
      })
    }

    const firstBoardEdgeOrdinal = nextEdgeOrdinal
    for (const coordinate of [bounds.y + δ, bounds.y + bounds.height - δ]) {
      addLine({
        vertical: false,
        coordinate,
        edgeOrdinal: nextEdgeOrdinal++,
      })
    }
    for (const coordinate of [bounds.x + δ, bounds.x + bounds.width - δ]) {
      addLine({
        vertical: true,
        coordinate,
        edgeOrdinal: nextEdgeOrdinal++,
      })
    }

    const firstBlockerEdgeOrdinal = nextEdgeOrdinal
    for (let sourceIndex = 0; sourceIndex < blockers.length; sourceIndex++) {
      const blocker = blockers[sourceIndex]!
      for (const coordinate of [blocker.x - δ, blocker.x + blocker.width + δ]) {
        const edgeOrdinal = nextEdgeOrdinal++
        if (
          !(
            coordinate > bounds.x + EPS &&
            coordinate < bounds.x + bounds.width - EPS
          )
        )
          continue
        addLine({
          vertical: true,
          coordinate,
          edgeOrdinal,
        })
      }
      for (const coordinate of [
        blocker.y - δ,
        blocker.y + blocker.height + δ,
      ]) {
        const edgeOrdinal = nextEdgeOrdinal++
        if (
          !(
            coordinate > bounds.y + EPS &&
            coordinate < bounds.y + bounds.height - EPS
          )
        )
          continue
        addLine({
          vertical: false,
          coordinate,
          edgeOrdinal,
        })
      }
    }

    nextOrder = layerOrder + nextEdgeOrdinal
    for (const vertical of [true, false]) {
      const lines = vertical ? verticalLines : horizontalLines
      for (const [coordinate, segments] of lines) {
        const indices = blockerIndex
          ? vertical
            ? blockerIndex.search(coordinate, -Infinity, coordinate, Infinity)
            : blockerIndex.search(-Infinity, coordinate, Infinity, coordinate)
          : []
        const coveringIntervals: ProjectedBlocker[] = []
        let hasReversedIntervals = false
        for (const sourceIndex of indices) {
          const blocker = blockers[sourceIndex]!
          if (
            vertical
              ? blocker.x > coordinate || blocker.x + blocker.width < coordinate
              : blocker.y > coordinate ||
                blocker.y + blocker.height < coordinate
          )
            continue
          const start = quantize(vertical ? blocker.y : blocker.x)
          const end = quantize(
            vertical ? blocker.y + blocker.height : blocker.x + blocker.width,
          )
          coveringIntervals.push({ start, end, sourceIndex })
          if (end < start) hasReversedIntervals = true
        }
        coveringIntervals.sort((a, b) => a.start - b.start)
        for (const edgeOrdinal of segments) {
          const isBoardEdge = edgeOrdinal < firstBlockerEdgeOrdinal
          const blockerEdgeOffset = edgeOrdinal - firstBlockerEdgeOrdinal
          const sourceIndex = isBoardEdge
            ? undefined
            : Math.floor(blockerEdgeOffset / edgesPerRectangle)
          const source = isBoardEdge ? bounds : blockers[sourceIndex!]!
          const leading = isBoardEdge
            ? edgeOrdinal === firstBoardEdgeOrdinal ||
              edgeOrdinal === firstBoardEdgeOrdinal + edgesPerAxis
            : blockerEdgeOffset % edgesPerRectangle === 0 ||
              blockerEdgeOffset % edgesPerRectangle === edgesPerAxis
          const start = vertical ? source.x : source.y
          const extent = vertical ? source.width : source.height
          // Recompute the original expression instead of emitting the group's
          // Map key: numerically equal keys can have different signed zeros.
          const exactCoordinate = isBoardEdge
            ? leading
              ? start + δ
              : start + extent - δ
            : leading
              ? start - δ
              : start + extent + δ
          const clipStart = vertical ? source.y : source.x
          const clipEnd = vertical
            ? source.y + source.height
            : source.x + source.width
          const uncovered = computeUncoveredSegments({
            segment: {
              lineStart: isBoardEdge ? clipStart + δ : clipStart,
              lineEnd: isBoardEdge ? clipEnd - δ : clipEnd,
              clipStart,
              clipEnd,
              sourceIndex,
            },
            coveringIntervals,
            hasReversedIntervals,
            minSegmentLength: minSize * 0.5,
          })
          let pointOrder = 0
          for (const gap of uncovered) {
            const pushAt = (position: number) =>
              pushIfFree({
                ...(vertical
                  ? { x: exactCoordinate, y: position, z }
                  : { x: position, y: exactCoordinate, z }),
                order: layerOrder + edgeOrdinal,
                pointOrder: pointOrder++,
              })
            const length = gap.end - gap.start
            if (isBoardEdge) {
              if (length < minSize) continue
              pushAt(gap.center)
              if (length > minSize * 1.5) {
                pushAt(gap.start + minSize * 0.4)
                pushAt(gap.end - minSize * 0.4)
              }
            } else {
              pushAt(gap.center)
            }
          }
        }
      }
    }
  }

  // Rank each accepted point once, in the same order as the exhaustive walk.
  const seeds = [...acceptedSeeds.values()].sort(
    (a, b) => a.order - b.order || a.pointOrder - b.pointOrder,
  )
  for (const { x, y, z } of seeds) {
    // Distance uses obstacles + hard nodes (soft nodes ignored for ranking)
    const hard = hardRectsByLayer[z] ?? []
    let d = distancePointToRectEdges({ x, y }, bounds)
    const hardRectIndex = hardRectIndexByLayer[z]
    if (hardRectIndex) {
      // A nearest box supplies an upper bound, not necessarily the nearest
      // edge: several rectangles may contain the point with different gaps.
      const nearestIndex = hardRectIndex.neighbors(x, y, 1)[0]!
      d = Math.min(d, distancePointToRectEdges({ x, y }, hard[nearestIndex]!))
      // Any edge closer than d belongs to a rectangle intersecting this square.
      const nearbyIndices = hardRectIndex.search(x - d, y - d, x + d, y + d)
      for (const index of nearbyIndices) {
        d = Math.min(d, distancePointToRectEdges({ x, y }, hard[index]!))
      }
    }
    const distance = quantize(d)

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
    out.push({
      x,
      y,
      z,
      distance,
      zSpanLen: span.length,
      isEdgeSeed: true,
    })
  }

  // Strong multi-layer preference then distance.
  out.sort(
    (a, b) =>
      b.zSpanLen! - a.zSpanLen! ||
      b.distance - a.distance ||
      a.z - b.z ||
      a.x - b.x ||
      a.y - b.y,
  )
  return out
}
