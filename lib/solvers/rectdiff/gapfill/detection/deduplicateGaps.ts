// lib/solvers/rectdiff/gapfill/detection/deduplicateGaps.ts
import { rectsEqual } from "../../../../../utils/rectsEqual"
import { rectsOverlap } from "../../../../../utils/rectsOverlap"
import type { GapRegion } from "../types"

export function deduplicateGaps(gaps: GapRegion[]): GapRegion[] {
  const result: GapRegion[] = []

  for (const gap of gaps) {
    // Check if we already have a gap at the same location with overlapping layers
    const existing = result.find(
      (g) =>
        rectsEqual(g.rect, gap.rect) ||
        (rectsOverlap(g.rect, gap.rect) &&
          gap.zLayers.some((z) => g.zLayers.includes(z))),
    )

    if (!existing) {
      result.push(gap)
    } else if (gap.zLayers.length > existing.zLayers.length) {
      // Replace with the one that has more layers
      const idx = result.indexOf(existing)
      result[idx] = gap
    }
  }

  return result
}
