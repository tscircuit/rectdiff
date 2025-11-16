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

/** Additional seeding pass: sample just inside the board edges and just outside
 * obstacle/placement edges to catch narrow corridors missed by the grid. */
export function computeEdgeCandidates3D(
  bounds: XYRect,
  sampleStep: number,
  layerCount: number,
  obstaclesByLayer: XYRect[][],
  placedByLayer: XYRect[][],
): Candidate3D[] {
  const out: Candidate3D[] = []
  const δ = Math.max(sampleStep * 0.25, EPS * 4)
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

    // 1) Board edges — sample just inside the border rectangle.
    for (let x = bounds.x + δ; x <= bounds.x + bounds.width - δ + EPS; x += sampleStep) {
      pushIfFree(x, bounds.y + δ, z)                         // top inside
      pushIfFree(x, bounds.y + bounds.height - δ, z)         // bottom inside
    }
    for (let y = bounds.y + δ; y <= bounds.y + bounds.height - δ + EPS; y += sampleStep) {
      pushIfFree(bounds.x + δ, y, z)                         // left inside
      pushIfFree(bounds.x + bounds.width - δ, y, z)          // right inside
    }

    // 2) Around every blocker edge — sample just outside the rectangle.
    for (const b of blockers) {
      // left and right "outside" of b
      for (let y = b.y; y <= b.y + b.height + EPS; y += sampleStep) {
        pushIfFree(b.x - δ, Math.min(y, b.y + b.height), z)
        pushIfFree(b.x + b.width + δ, Math.min(y, b.y + b.height), z)
      }
      // top and bottom "outside" of b
      for (let x = b.x; x <= b.x + b.width + EPS; x += sampleStep) {
        pushIfFree(Math.min(x, b.x + b.width), b.y - δ, z)
        pushIfFree(Math.min(x, b.x + b.width), b.y + b.height + δ, z)
      }
    }
  }

  // Strong multi-layer preference then distance.
  out.sort((a, b) => (b.zSpanLen! - a.zSpanLen!) || (b.distance - a.distance))
  return out
}
