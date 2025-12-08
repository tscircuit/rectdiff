// lib/solvers/rectdiff/gapfill/engine/findUncoveredPoints.ts
import { isPointInsideOutline } from "../../geometry"
import type { LayerContext } from "../types"

/**
 * Find uncovered points for debugging gaps.
 */
export function findUncoveredPoints(
  { sampleResolution = 0.05 }: { sampleResolution?: number },
  ctx: LayerContext,
): Array<{ x: number; y: number; z: number }> {
  const { bounds, layerCount, obstaclesByLayer, placedByLayer } = ctx

  const uncovered: Array<{ x: number; y: number; z: number }> = []

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
        if (!isPointInsideOutline(x, y, ctx.outlineSegments)) continue
        const isCovered = allRects.some(
          (r) =>
            x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
        )

        if (!isCovered) {
          uncovered.push({ x, y, z })
        }
      }
    }
  }

  return uncovered
}
