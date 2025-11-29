// lib/solvers/rectdiff/gapfill/detection/findAllGaps.ts
import type { XYRect } from "../../types"
import type { GapRegion, LayerContext } from "../types"
import { EPS } from "../../geometry"
import { findGapsOnLayer } from "./findGapsOnLayer"
import { rectsOverlap } from "../../../../../utils/rectsOverlap"
import { deduplicateGaps } from "./deduplicateGaps"

/**
 * Find gaps across all layers and return GapRegions with z-layer info.
 */
export function findAllGaps(
  {
    scanResolution,
    minWidth,
    minHeight,
  }: {
    scanResolution: number
    minWidth: number
    minHeight: number
  },
  ctx: LayerContext,
): GapRegion[] {
  const { bounds, layerCount, obstaclesByLayer, placedByLayer } = ctx

  // Find gaps on each layer
  const gapsByLayer: XYRect[][] = []
  for (let z = 0; z < layerCount; z++) {
    const obstacles = obstaclesByLayer[z] ?? []
    const placed = placedByLayer[z] ?? []
    const gaps = findGapsOnLayer({ bounds, obstacles, placed, scanResolution })
    gapsByLayer.push(gaps)
  }

  // Convert to GapRegions with z-layer info
  const allGaps: GapRegion[] = []

  for (let z = 0; z < layerCount; z++) {
    for (const gap of gapsByLayer[z]!) {
      // Filter out gaps that are too small
      if (gap.width < minWidth - EPS || gap.height < minHeight - EPS) continue

      // Check if this gap exists on adjacent layers too
      const zLayers = [z]

      // Look up
      for (let zu = z + 1; zu < layerCount; zu++) {
        const hasOverlap = gapsByLayer[zu]!.some((g) => rectsOverlap(g, gap))
        if (hasOverlap) zLayers.push(zu)
        else break
      }

      // Look down (if z > 0 and not already counted)
      for (let zd = z - 1; zd >= 0; zd--) {
        const hasOverlap = gapsByLayer[zd]!.some((g) => rectsOverlap(g, gap))
        if (hasOverlap && !zLayers.includes(zd)) zLayers.unshift(zd)
        else break
      }

      allGaps.push({
        rect: gap,
        zLayers: zLayers.sort((a, b) => a - b),
        centerX: gap.x + gap.width / 2,
        centerY: gap.y + gap.height / 2,
        area: gap.width * gap.height,
      })
    }
  }

  // Deduplicate gaps that are essentially the same across layers
  const deduped = deduplicateGaps(allGaps)

  // Sort by priority: prefer larger gaps and multi-layer gaps
  deduped.sort((a, b) => {
    // Prefer multi-layer gaps
    const layerDiff = b.zLayers.length - a.zLayers.length
    if (layerDiff !== 0) return layerDiff
    // Then prefer larger area
    return b.area - a.area
  })

  return deduped
}
