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
        out.push({ x, y, z, distance: d })
      }
    }
  }

  out.sort((a, b) => b.distance - a.distance)
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
