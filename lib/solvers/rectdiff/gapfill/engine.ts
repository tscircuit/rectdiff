// lib/solvers/rectdiff/gapfill/engine.ts
import type { XYRect, Placed3D } from "../types"
import type {
  GapFillState,
  GapFillOptions,
  GapRegion,
  LayerContext,
} from "./types"
import { findAllGaps } from "./detection"
import { expandRectFromSeed } from "../geometry"

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
  params: {
    placed: Placed3D[]
    options?: Partial<GapFillOptions>
  },
  ctx: LayerContext,
): GapFillState {
  const { placed, options } = params
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

/**
 * Perform one step of gap filling with four-stage visualization.
 * Stages: scan → select → expand → place
 * Returns true if still working, false if done.
 */
export function stepGapFill(state: GapFillState): boolean {
  if (state.done) return false

  switch (state.stage) {
    case "scan": {
      // Stage 1: Gap detection/scanning

      // Check if we need to find new gaps
      if (
        state.gapsFound.length === 0 ||
        state.gapIndex >= state.gapsFound.length
      ) {
        // Check if we've hit max iterations
        if (state.iteration >= state.options.maxIterations) {
          state.done = true
          return false
        }

        // Find new gaps
        state.gapsFound = findAllGaps(
          {
            scanResolution: state.options.scanResolution,
            minWidth: state.options.minWidth,
            minHeight: state.options.minHeight,
          },
          {
            bounds: state.bounds,
            layerCount: state.layerCount,
            obstaclesByLayer: state.obstaclesByLayer,
            placedByLayer: state.placedByLayer,
          },
        )

        if (state.iteration === 0) {
          state.initialGapCount = state.gapsFound.length
        }

        state.gapIndex = 0
        state.iteration++

        // If no gaps found, we're done
        if (state.gapsFound.length === 0) {
          state.done = true
          return false
        }
      }

      // Move to select stage
      state.stage = "select"
      return true
    }

    case "select": {
      // Stage 2: Show the gap being targeted
      if (state.gapIndex >= state.gapsFound.length) {
        // No more gaps in this iteration, go back to scan
        state.stage = "scan"
        return true
      }

      state.currentGap = state.gapsFound[state.gapIndex]!
      state.currentSeed = {
        x: state.currentGap.centerX,
        y: state.currentGap.centerY,
      }
      state.expandedRect = null

      // Move to expand stage
      state.stage = "expand"
      return true
    }

    case "expand": {
      // Stage 3: Show expansion attempt
      if (!state.currentGap) {
        // Shouldn't happen, but handle gracefully
        state.stage = "select"
        return true
      }

      // Try to expand from the current seed
      const expandedRect = tryExpandGap(state, {
        gap: state.currentGap,
        seed: state.currentSeed!,
      })
      state.expandedRect = expandedRect

      // Move to place stage
      state.stage = "place"
      return true
    }

    case "place": {
      // Stage 4: Show the placed result
      if (state.expandedRect && state.currentGap) {
        // Actually place the rectangle
        addPlacement(state, {
          rect: state.expandedRect,
          zLayers: state.currentGap.zLayers,
        })
        state.filledCount++
      }

      // Move to next gap and reset to select stage
      state.gapIndex++
      state.currentGap = null
      state.currentSeed = null
      state.expandedRect = null
      state.stage = "select"
      return true
    }

    default:
      state.stage = "scan"
      return true
  }
}

/**
 * Try to expand a rectangle from a seed point within the gap.
 * Returns the expanded rectangle or null if expansion fails.
 */
function tryExpandGap(
  state: GapFillState,
  params: {
    gap: GapRegion
    seed: { x: number; y: number }
  },
): XYRect | null {
  const { gap, seed } = params
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
      })

      if (altRect) {
        return altRect
      }
    }

    return null
  }

  return rect
}

/**
 * Try to fill a single gap region using relaxed constraints.
 * (Legacy function - kept for compatibility)
 */
function tryFillGap(state: GapFillState, gap: GapRegion): boolean {
  const rect = tryExpandGap(state, {
    gap,
    seed: { x: gap.centerX, y: gap.centerY },
  })
  if (rect) {
    addPlacement(state, { rect, zLayers: gap.zLayers })
    return true
  }
  return false
}

/**
 * Add a new placement to the state.
 */
function addPlacement(
  state: GapFillState,
  params: {
    rect: XYRect
    zLayers: number[]
  },
): void {
  const { rect, zLayers } = params
  const placed: Placed3D = { rect, zLayers: [...zLayers] }
  state.placed.push(placed)

  for (const z of zLayers) {
    if (!state.placedByLayer[z]) {
      state.placedByLayer[z] = []
    }
    state.placedByLayer[z]!.push(rect)
  }
}

/**
 * Run gap filling to completion.
 */
export function runGapFillToCompletion(state: GapFillState): void {
  while (stepGapFill(state)) {
    // Continue until done
  }
}

/**
 * Calculate coverage percentage (0-1).
 */
export function calculateCoverage(
  params: { sampleResolution?: number },
  ctx: LayerContext,
): number {
  const sampleResolution = params.sampleResolution ?? 0.1
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

/**
 * Find uncovered points for debugging gaps.
 */
export function findUncoveredPoints(
  params: { sampleResolution?: number },
  ctx: LayerContext,
): Array<{ x: number; y: number; z: number }> {
  const sampleResolution = params.sampleResolution ?? 0.05
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

/**
 * Get progress as a number between 0 and 1.
 * Accounts for four-stage processing (scan → select → expand → place for each gap).
 */
export function getGapFillProgress(state: GapFillState): number {
  if (state.done) return 1

  const iterationProgress = state.iteration / state.options.maxIterations
  const gapProgress =
    state.gapsFound.length > 0 ? state.gapIndex / state.gapsFound.length : 0

  // Add sub-progress within current gap based on stage
  let stageProgress = 0
  switch (state.stage) {
    case "scan":
      stageProgress = 0
      break
    case "select":
      stageProgress = 0.25
      break
    case "expand":
      stageProgress = 0.5
      break
    case "place":
      stageProgress = 0.75
      break
  }

  const gapStageProgress =
    state.gapsFound.length > 0
      ? stageProgress / (state.gapsFound.length * 4) // 4 stages per gap
      : 0

  return Math.min(
    0.999,
    iterationProgress +
      (gapProgress + gapStageProgress) / state.options.maxIterations,
  )
}
