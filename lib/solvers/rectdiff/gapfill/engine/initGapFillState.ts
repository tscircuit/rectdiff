// lib/solvers/rectdiff/gapfill/engine/initGapFillState.ts
import type { Placed3D } from "../../types"
import type { GapFillState, GapFillOptions, LayerContext } from "../types"

const DEFAULT_OPTIONS: GapFillOptions = {
  minWidth: 0.1,
  minHeight: 0.1,
  maxIterations: 10,
  targetCoverage: 0.999,
  scanResolution: 0.5,
}

/**
 * Initialize the gap fill state from existing rectdiff state.
 */
export function initGapFillState(
  {
    placed,
    options,
  }: {
    placed: Placed3D[]
    options?: Partial<GapFillOptions>
  },
  ctx: LayerContext,
): GapFillState {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Deep copy placed arrays to avoid mutation issues
  const placedCopy = placed.map((p) => ({
    rect: { ...p.rect },
    zLayers: [...p.zLayers],
  }))

  const placedByLayerCopy = ctx.placedByLayer.map((layer) =>
    layer.map((r) => ({ ...r })),
  )

  return {
    bounds: { ...ctx.bounds },
    layerCount: ctx.layerCount,
    obstaclesByLayer: ctx.obstaclesByLayer,
    placed: placedCopy,
    placedByLayer: placedByLayerCopy,
    options: opts,
    iteration: 0,
    gapsFound: [],
    gapIndex: 0,
    done: false,
    initialGapCount: 0,
    filledCount: 0,
    // Four-stage visualization state
    stage: "scan",
    currentGap: null,
    currentSeed: null,
    expandedRect: null,
  }
}
