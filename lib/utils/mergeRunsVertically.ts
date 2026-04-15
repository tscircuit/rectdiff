import type { Rect3d } from "../rectdiff-types"
import { EPS } from "./rectdiff-geometry"

/** Merge adjacent runs into rectangles. */
export function mergeRunsVertically(
  runs: Array<{
    minX: number
    maxX: number
    minY: number
    maxY: number
    zLayers: number[]
  }>,
): Rect3d[] {
  const sorted = runs.slice().sort((a, b) => {
    if (Math.abs(a.minY - b.minY) > EPS) {
      return a.minY - b.minY
    }
    if (Math.abs(a.maxY - b.maxY) > EPS) {
      return a.maxY - b.maxY
    }
    if (Math.abs(a.minX - b.minX) > EPS) {
      return a.minX - b.minX
    }
    if (Math.abs(a.maxX - b.maxX) > EPS) {
      return a.maxX - b.maxX
    }
    return a.zLayers.join(",").localeCompare(b.zLayers.join(","))
  })

  const out: Rect3d[] = []
  const active = new Map<string, Rect3d>()

  for (const run of sorted) {
    const key = [
      run.minX.toFixed(9),
      run.maxX.toFixed(9),
      run.zLayers.join(","),
    ].join(":")
    const existing = active.get(key)

    if (existing && Math.abs(existing.maxY - run.minY) <= EPS) {
      existing.maxY = run.maxY
      continue
    }

    if (existing) {
      out.push(existing)
    }

    active.set(key, {
      minX: run.minX,
      minY: run.minY,
      maxX: run.maxX,
      maxY: run.maxY,
      zLayers: run.zLayers.slice(),
    })
  }

  for (const rect of active.values()) {
    out.push(rect)
  }

  return out
    .filter(
      (rect) => rect.maxX - rect.minX > EPS && rect.maxY - rect.minY > EPS,
    )
    .sort((a, b) => {
      const aKey = a.zLayers.join(",")
      const bKey = b.zLayers.join(",")
      if (aKey !== bKey) {
        return aKey.localeCompare(bKey)
      }
      if (Math.abs(a.minY - b.minY) > EPS) {
        return a.minY - b.minY
      }
      if (Math.abs(a.minX - b.minX) > EPS) {
        return a.minX - b.minX
      }
      if (Math.abs(a.maxY - b.maxY) > EPS) {
        return a.maxY - b.maxY
      }
      return a.maxX - b.maxX
    })
}
