// lib/solvers/rectdiff/engine.ts
import type { RectDiffState, GridFill3DOptions, XYRect, Placed3D, Rect3d } from "./types"
import type { SimpleRouteJson } from "../../types/srj-types"
import { buildZIndexMap, obstacleToXYRect, obstacleZs } from "./layers"
import {
  computeCandidates3D,
  longestFreeSpanAroundZ,
  computeDefaultGridSizes,
  computeEdgeCandidates3D,
} from "./candidates"
import { expandRectFromSeed } from "./geometry"

export function initState(srj: SimpleRouteJson, opts: Partial<GridFill3DOptions>): RectDiffState {
  const { layerNames, zIndexByName } = buildZIndexMap(srj)
  const layerCount = Math.max(1, layerNames.length, srj.layerCount || 1)

  const bounds: XYRect = {
    x: srj.bounds.minX,
    y: srj.bounds.minY,
    width: srj.bounds.maxX - srj.bounds.minX,
    height: srj.bounds.maxY - srj.bounds.minY,
  }

  // Obstacles per layer
  const obstaclesByLayer: XYRect[][] = Array.from({ length: layerCount }, () => [])
  for (const ob of srj.obstacles ?? []) {
    const r = obstacleToXYRect(ob)
    if (!r) continue
    const zs = obstacleZs(ob, zIndexByName)
    for (const z of zs) if (z >= 0 && z < layerCount) obstaclesByLayer[z]!.push(r)
  }

  const trace = Math.max(0.01, srj.minTraceWidth || 0.15)
  const defaults: Required<Omit<GridFill3DOptions, "gridSizes" | "maxMultiLayerSpan" | "maxSingleLayerNodeSize">> & {
    gridSizes: number[]
    maxMultiLayerSpan: number | undefined
    maxSingleLayerNodeSize: number
  } = {
    gridSizes: computeDefaultGridSizes(bounds),
    initialCellRatio: 0.2,
    maxAspectRatio: 3,
    minSingle: { width: 2 * trace, height: 2 * trace },
    minMulti: {
      width: 4 * trace,
      height: 4 * trace,
      minLayers: Math.min(2, Math.max(1, srj.layerCount || 1)),
    },
    preferMultiLayer: true,
    maxMultiLayerSpan: undefined,
    maxSingleLayerNodeSize: 0.5,
  }

  const options = { ...defaults, ...opts, gridSizes: opts.gridSizes ?? defaults.gridSizes }

  const placedByLayer: XYRect[][] = Array.from({ length: layerCount }, () => [])

  // Begin at the **first** grid level; candidates computed lazily on first step
  return {
    srj,
    layerNames,
    layerCount,
    bounds,
    options,
    obstaclesByLayer,
    phase: "GRID",
    gridIndex: 0,
    candidates: [],
    placed: [],
    placedByLayer,
    expansionIndex: 0,
    edgeAnalysisDone: false,
    totalSeedsThisGrid: 0,
    consumedSeedsThisGrid: 0,
  }
}

/** One micro-step during the GRID phase: handle (or fetch) exactly one candidate */
export function stepGrid(state: RectDiffState): void {
  const {
    gridSizes,
    initialCellRatio,
    maxAspectRatio,
    minSingle,
    minMulti,
    preferMultiLayer,
    maxMultiLayerSpan,
    maxSingleLayerNodeSize,
  } =
    state.options
  const grid = gridSizes[state.gridIndex]!

  // Ensure candidates exist for this grid
  if (state.candidates.length === 0 && state.consumedSeedsThisGrid === 0) {
    state.candidates = computeCandidates3D(
      state.bounds,
      grid,
      state.layerCount,
      state.obstaclesByLayer,
      state.placedByLayer,
    )
    state.totalSeedsThisGrid = state.candidates.length
    state.consumedSeedsThisGrid = 0
    // Do not consume in this call; next lines will.
  }

  // If no candidates remain, advance grid or switch phase
  if (state.candidates.length === 0) {
    if (state.gridIndex + 1 < gridSizes.length) {
      // next grid level
      state.gridIndex += 1
      state.totalSeedsThisGrid = 0
      state.consumedSeedsThisGrid = 0
      return
    } else {
      // Before expansion, run a one-time edge-analysis pass to catch narrow gaps
      if (!state.edgeAnalysisDone) {
        // Use the minimum single-layer size as the threshold for finding gaps
        const minSize = Math.min(minSingle.width, minSingle.height)
        state.candidates = computeEdgeCandidates3D(
          state.bounds,
          minSize,
          state.layerCount,
          state.obstaclesByLayer,
          state.placedByLayer,
        )
        state.edgeAnalysisDone = true
        state.totalSeedsThisGrid = state.candidates.length
        state.consumedSeedsThisGrid = 0
        // Stay in GRID phase to reuse placement logic
        return
      }
      // move to expansion phase
      state.phase = "EXPANSION"
      state.expansionIndex = 0
      return
    }
  }

  // Consume exactly one candidate
  const cand = state.candidates.shift()!
  state.consumedSeedsThisGrid += 1

  const attempts: Array<{
    kind: "multi" | "single"
    layers: number[]
    minReq: { width: number; height: number }
  }> = []

  // Multi-layer first (optional)
  const span = longestFreeSpanAroundZ(
    cand.x,
    cand.y,
    cand.z,
    state.layerCount,
    minMulti.minLayers,
    maxMultiLayerSpan,
    state.obstaclesByLayer,
    state.placedByLayer,
  )
  if (span.length >= minMulti.minLayers) {
    attempts.push({ kind: "multi", layers: span, minReq: { width: minMulti.width, height: minMulti.height } })
  }
  attempts.push({ kind: "single", layers: [cand.z], minReq: { width: minSingle.width, height: minSingle.height } })

  const ordered = preferMultiLayer ? attempts : attempts.reverse()

  for (const attempt of ordered) {
    // blockers are union of obstacles + already placed on any of those layers
    const blockers: XYRect[] = []
    for (const z of attempt.layers) {
      if (state.obstaclesByLayer[z]) blockers.push(...state.obstaclesByLayer[z]!)
      if (state.placedByLayer[z]) blockers.push(...state.placedByLayer[z]!)
    }

    let rect = expandRectFromSeed(
      cand.x,
      cand.y,
      grid,
      state.bounds,
      blockers,
      initialCellRatio,
      maxAspectRatio,
      attempt.minReq,
    )
    if (!rect) continue

    // Enforce cap on single-layer nodes to favor multi-layer placement
    if (attempt.kind === "single" && Number.isFinite(maxSingleLayerNodeSize)) {
      const cap = maxSingleLayerNodeSize as number
      const clampedW = Math.max(minSingle.width, Math.min(rect.width, cap))
      const clampedH = Math.max(minSingle.height, Math.min(rect.height, cap))
      if (clampedW !== rect.width || clampedH !== rect.height) {
        const cx = rect.x + rect.width / 2
        const cy = rect.y + rect.height / 2
        rect = { x: cx - clampedW / 2, y: cy - clampedH / 2, width: clampedW, height: clampedH }
      }
    }

    // Accept placement
    const placed: Placed3D = { rect, zLayers: [...attempt.layers] }
    state.placed.push(placed)
    for (const z of attempt.layers) state.placedByLayer[z]!.push(rect)

    // Cull future candidates that fall inside rect on any used layer
    state.candidates = state.candidates.filter(
      (c) => !attempt.layers.includes(c.z) || !(c.x >= rect.x && c.x <= rect.x + rect.width && c.y >= rect.y && c.y <= rect.y + rect.height),
    )

    return // exactly one candidate processed this step
  }

  // If neither attempt worked, we simply drop this candidate — done for this step.
}

/** One micro-step during the EXPANSION phase: expand exactly one placed rect */
export function stepExpansion(state: RectDiffState): void {
  if (state.expansionIndex >= state.placed.length) {
    state.phase = "DONE"
    return
  }

  const p = state.placed[state.expansionIndex]!
  const lastGrid = state.options.gridSizes[state.options.gridSizes.length - 1]!

  // Blockers: obstacles on used layers + other placed on intersecting layers
  const blockers: XYRect[] = []
  for (const z of p.zLayers) {
    blockers.push(...(state.obstaclesByLayer[z] ?? []))
  }
  for (let i = 0; i < state.placed.length; i++) {
    if (i === state.expansionIndex) continue
    const other = state.placed[i]!
    if (other.zLayers.some((z) => p.zLayers.includes(z))) blockers.push(other.rect)
  }

  const expanded = expandRectFromSeed(
    p.rect.x + p.rect.width / 2,
    p.rect.y + p.rect.height / 2,
    lastGrid,
    state.bounds,
    blockers,
    0,       // seed bias off; start from the rect we have
    null,    // no aspect cap in expansion pass
    { width: p.rect.width, height: p.rect.height },
  )
  if (expanded) state.placed[state.expansionIndex] = { rect: expanded, zLayers: p.zLayers }

  state.expansionIndex += 1 // exactly one expansion per step
}

export function finalizeRects(state: RectDiffState): Rect3d[] {
  return state.placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))
}

/** Optional: rough progress number for BaseSolver.progress */
export function computeProgress(state: RectDiffState): number {
  const grids = state.options.gridSizes.length
  if (state.phase === "GRID") {
    const g = state.gridIndex
    const base = g / (grids + 1) // reserve final slice for expansion
    const denom = Math.max(1, state.totalSeedsThisGrid)
    const frac = denom ? state.consumedSeedsThisGrid / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }
  if (state.phase === "EXPANSION") {
    const base = grids / (grids + 1)
    const denom = Math.max(1, state.placed.length)
    const frac = denom ? state.expansionIndex / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }
  return 1
}
