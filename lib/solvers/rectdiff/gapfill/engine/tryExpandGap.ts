// lib/solvers/rectdiff/gapfill/engine/tryExpandGap.ts
import type { XYRect } from "../../types"
import type { GapFillState, GapRegion } from "../types"
import { expandRectFromSeed } from "../../geometry"

/**
 * Try to expand a rectangle from a seed point within the gap.
 * Returns the expanded rectangle or null if expansion fails.
 */
export function tryExpandGap(
  state: GapFillState,
  {
    gap,
    seed,
  }: {
    gap: GapRegion
    seed: { x: number; y: number }
  },
): XYRect | null {
  // Build blockers for the gap's z-layers
  const blockers: XYRect[] = []
  for (const z of gap.zLayers) {
    blockers.push(...(state.obstaclesByLayer[z] ?? []))
    blockers.push(...(state.placedByLayer[z] ?? []))
  }

  // Try to expand from the seed point
  const rect = expandRectFromSeed({
    startX: seed.x,
    startY: seed.y,
    gridSize: Math.min(gap.rect.width, gap.rect.height),
    bounds: state.bounds,
    blockers,
    initialCellRatio: 0,
    maxAspectRatio: null,
    minReq: { width: state.options.minWidth, height: state.options.minHeight },
    outlineSegments: state.outlineSegments,
  })

  if (!rect) {
    // Try additional seed points within the gap
    const seeds = [
      { x: gap.rect.x + state.options.minWidth / 2, y: gap.centerY },
      {
        x: gap.rect.x + gap.rect.width - state.options.minWidth / 2,
        y: gap.centerY,
      },
      { x: gap.centerX, y: gap.rect.y + state.options.minHeight / 2 },
      {
        x: gap.centerX,
        y: gap.rect.y + gap.rect.height - state.options.minHeight / 2,
      },
    ]

    for (const altSeed of seeds) {
      const altRect = expandRectFromSeed({
        startX: altSeed.x,
        startY: altSeed.y,
        gridSize: Math.min(gap.rect.width, gap.rect.height),
        bounds: state.bounds,
        blockers,
        initialCellRatio: 0,
        maxAspectRatio: null,
        minReq: {
          width: state.options.minWidth,
          height: state.options.minHeight,
        },
        outlineSegments: state.outlineSegments,
      })

      if (altRect) {
        return altRect
      }
    }

    return null
  }

  return rect
}
