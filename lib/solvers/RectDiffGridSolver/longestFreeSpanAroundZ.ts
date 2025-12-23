import type { XYRect } from "../../rectdiff-types"
import { clamp, containsPoint } from "../../utils/rectdiff-geometry"

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
