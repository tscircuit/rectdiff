import type { Placed3D } from "../rectdiff-types"
import { EPS } from "./rectdiff-geometry"
import { dedupeSortedEdges } from "./dedupeSortedEdges"
import { getCellLayerRuns } from "./getCellLayerRuns"

/** Build horizontal runs for layered rectangles. */
export function buildRowRuns(placed: Placed3D[]) {
  const xEdges = dedupeSortedEdges(
    placed.flatMap((placement) => [
      placement.rect.x,
      placement.rect.x + placement.rect.width,
    ]),
  )
  const yEdges = dedupeSortedEdges(
    placed.flatMap((placement) => [
      placement.rect.y,
      placement.rect.y + placement.rect.height,
    ]),
  )

  const runs: Array<{
    minX: number
    maxX: number
    minY: number
    maxY: number
    zLayers: number[]
  }> = []

  for (let yi = 0; yi < yEdges.length - 1; yi++) {
    const minY = yEdges[yi]!
    const maxY = yEdges[yi + 1]!
    if (maxY - minY <= EPS) {
      continue
    }

    const openRuns = new Map<
      string,
      {
        minX: number
        maxX: number
        minY: number
        maxY: number
        zLayers: number[]
      }
    >()

    for (let xi = 0; xi < xEdges.length - 1; xi++) {
      const minX = xEdges[xi]!
      const maxX = xEdges[xi + 1]!
      if (maxX - minX <= EPS) {
        continue
      }

      const layerRuns = getCellLayerRuns({
        minX,
        maxX,
        minY,
        maxY,
        placed,
      })

      const seenKeys = new Set<string>()

      for (const zLayers of layerRuns) {
        const key = zLayers.join(",")
        seenKeys.add(key)
        const existing = openRuns.get(key)

        if (existing && Math.abs(existing.maxX - minX) <= EPS) {
          existing.maxX = maxX
          continue
        }

        if (existing) {
          runs.push(existing)
        }

        openRuns.set(key, {
          minX,
          maxX,
          minY,
          maxY,
          zLayers,
        })
      }

      for (const [key, run] of openRuns) {
        if (seenKeys.has(key)) {
          continue
        }
        runs.push(run)
        openRuns.delete(key)
      }
    }

    for (const run of openRuns.values()) {
      runs.push(run)
    }
  }

  return runs
}
