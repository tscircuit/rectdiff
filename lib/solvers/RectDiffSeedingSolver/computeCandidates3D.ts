import type { Candidate3D, XYRect } from "../../rectdiff-types"
import { EPS, distancePointToRectEdges } from "../../utils/rectdiff-geometry"
import { isFullyOccupiedAtPoint } from "../../utils/isFullyOccupiedAtPoint"
import { longestFreeSpanAroundZ } from "./longestFreeSpanAroundZ"
import type RBush from "rbush"
import type { RTreeRect } from "lib/types/capacity-mesh-types"
const quantize = (value: number, precision = 1e-6) =>
  Math.round(value / precision) * precision

/**
 * Compute candidate seed points for a given grid size.
 */
export function computeCandidates3D(params: {
  bounds: XYRect
  gridSize: number
  layerCount: number
  obstacleIndexByLayer: Array<RBush<RTreeRect> | undefined>
  placedIndexByLayer: Array<RBush<RTreeRect> | undefined>
  hardPlacedByLayer: XYRect[][]
}): Candidate3D[] {
  const {
    bounds,
    gridSize,
    layerCount,
    obstacleIndexByLayer,
    placedIndexByLayer,
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
        isFullyOccupiedAtPoint({
          layerCount,
          obstacleIndexByLayer,
          placedIndexByLayer,
          point: { x, y },
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
          obstacleIndexByLayer,
          additionalBlockersByLayer: hardPlacedByLayer,
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
        ...(obstacleIndexByLayer[anchorZ]?.all() ?? []),
        ...(hardPlacedByLayer[anchorZ] ?? []),
      ]
      const d = Math.min(
        distancePointToRectEdges({ x, y }, bounds),
        ...(hardAtZ.length
          ? hardAtZ.map((b) => distancePointToRectEdges({ x, y }, b))
          : [Infinity]),
      )
      const distance = quantize(d)

      const k = `${x.toFixed(6)}|${y.toFixed(6)}`
      const cand: Candidate3D = {
        x,
        y,
        z: anchorZ,
        distance,
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
  arr.sort(
    (a, b) =>
      b.zSpanLen! - a.zSpanLen! ||
      b.distance - a.distance ||
      a.z - b.z ||
      a.x - b.x ||
      a.y - b.y,
  )
  return arr
}
