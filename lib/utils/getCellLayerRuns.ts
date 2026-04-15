import type { Placed3D } from "../rectdiff-types"
import { containsPoint } from "./rectdiff-geometry"
import { splitIntoContiguousLayerRuns } from "./splitIntoContiguousLayerRuns"

/** Collect contiguous zLayer runs for a cell. */
export function getCellLayerRuns(params: {
  minX: number
  maxX: number
  minY: number
  maxY: number
  placed: Placed3D[]
}): number[][] {
  const { minX, maxX, minY, maxY, placed } = params
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const zLayers = new Set<number>()

  for (const placement of placed) {
    if (!containsPoint(placement.rect, { x: midX, y: midY })) {
      continue
    }

    for (const z of placement.zLayers) {
      zLayers.add(z)
    }
  }

  return splitIntoContiguousLayerRuns(Array.from(zLayers))
}
