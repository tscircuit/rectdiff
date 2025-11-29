// lib/solvers/rectdiff/gapfill/engine/calculateCoverage.ts
import type { LayerContext } from "../types"

/**
 * Calculate coverage percentage (0-1).
 */
export function calculateCoverage(
  { sampleResolution = 0.1 }: { sampleResolution?: number },
  ctx: LayerContext,
): number {
  const { bounds, layerCount, obstaclesByLayer, placedByLayer } = ctx

  let totalPoints = 0
  let coveredPoints = 0

  for (let z = 0; z < layerCount; z++) {
    const obstacles = obstaclesByLayer[z] ?? []
    const placed = placedByLayer[z] ?? []
    const allRects = [...obstacles, ...placed]

    for (
      let x = bounds.x;
      x <= bounds.x + bounds.width;
      x += sampleResolution
    ) {
      for (
        let y = bounds.y;
        y <= bounds.y + bounds.height;
        y += sampleResolution
      ) {
        totalPoints++

        const isCovered = allRects.some(
          (r) =>
            x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
        )

        if (isCovered) coveredPoints++
      }
    }
  }

  return totalPoints > 0 ? coveredPoints / totalPoints : 1
}
