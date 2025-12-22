// lib/solvers/rectdiff/engine.ts
import type {
  GridFill3DOptions,
  Placed3D,
  Rect3d,
  XYRect,
  Candidate3D,
  Phase,
} from "./types"
import {
  computeCandidates3D,
  computeEdgeCandidates3D,
  longestFreeSpanAroundZ,
} from "./candidates"
import {
  EPS,
  containsPoint,
  expandRectFromSeed,
  overlaps,
  subtractRect2D,
} from "./geometry"

/**
 * Build per-layer list of "hard" placed rects (nodes spanning all layers).
 */
function buildHardPlacedByLayer(params: {
  layerCount: number
  placed: Placed3D[]
}): XYRect[][] {
  const out: XYRect[][] = Array.from({ length: params.layerCount }, () => [])
  for (const p of params.placed) {
    if (p.zLayers.length >= params.layerCount) {
      for (const z of p.zLayers) out[z]!.push(p.rect)
    }
  }
  return out
}

/**
 * Check if a point is occupied on ALL layers.
 */
function isFullyOccupiedAtPoint(
  params: {
    layerCount: number
    obstaclesByLayer: XYRect[][]
    placedByLayer: XYRect[][]
  },
  point: { x: number; y: number },
): boolean {
  for (let z = 0; z < params.layerCount; z++) {
    const obs = params.obstaclesByLayer[z] ?? []
    const placed = params.placedByLayer[z] ?? []
    const occ =
      obs.some((b) => containsPoint(b, point.x, point.y)) ||
      placed.some((b) => containsPoint(b, point.x, point.y))
    if (!occ) return false
  }
  return true
}

/**
 * Shrink/split any soft (non-full-stack) nodes overlapped by the newcomer.
 */
function resizeSoftOverlaps(
  params: {
    layerCount: number
    placed: Placed3D[]
    placedByLayer: XYRect[][]
    options: any
  },
  newIndex: number,
) {
  const newcomer = params.placed[newIndex]!
  const { rect: newR, zLayers: newZs } = newcomer
  const layerCount = params.layerCount

  const removeIdx: number[] = []
  const toAdd: typeof params.placed = []

  for (let i = 0; i < params.placed.length; i++) {
    if (i === newIndex) continue
    const old = params.placed[i]!
    // Protect full-stack nodes
    if (old.zLayers.length >= layerCount) continue

    const sharedZ = old.zLayers.filter((z) => newZs.includes(z))
    if (sharedZ.length === 0) continue
    if (!overlaps(old.rect, newR)) continue

    // Carve the overlap on the shared layers
    const parts = subtractRect2D(old.rect, newR)

    // We will replace `old` entirely; re-add unaffected layers (same rect object).
    removeIdx.push(i)

    const unaffectedZ = old.zLayers.filter((z) => !newZs.includes(z))
    if (unaffectedZ.length > 0) {
      toAdd.push({ rect: old.rect, zLayers: unaffectedZ })
    }

    // Re-add carved pieces for affected layers, dropping tiny slivers
    const minW = Math.min(
      params.options.minSingle.width,
      params.options.minMulti.width,
    )
    const minH = Math.min(
      params.options.minSingle.height,
      params.options.minMulti.height,
    )
    for (const p of parts) {
      if (p.width + EPS >= minW && p.height + EPS >= minH) {
        toAdd.push({ rect: p, zLayers: sharedZ.slice() })
      }
    }
  }

  // Remove (and clear placedByLayer)
  removeIdx
    .sort((a, b) => b - a)
    .forEach((idx) => {
      const rem = params.placed.splice(idx, 1)[0]!
      for (const z of rem.zLayers) {
        const arr = params.placedByLayer[z]!
        const j = arr.findIndex((r) => r === rem.rect)
        if (j >= 0) arr.splice(j, 1)
      }
    })

  // Add replacements
  for (const p of toAdd) {
    params.placed.push(p)
    for (const z of p.zLayers) params.placedByLayer[z]!.push(p.rect)
  }
}

/**
 * One micro-step during the GRID phase: handle exactly one candidate.
 */
export function stepGrid(params: {
  options: Required<
    Omit<GridFill3DOptions, "gridSizes" | "maxMultiLayerSpan">
  > & {
    gridSizes: number[]
    maxMultiLayerSpan: number | undefined
  }
  gridIndex: number
  candidates: Candidate3D[]
  consumedSeedsThisGrid: number
  totalSeedsThisGrid: number
  bounds: XYRect
  layerCount: number
  obstaclesByLayer: XYRect[][]
  placedByLayer: XYRect[][]
  edgeAnalysisDone: boolean
  phase: Phase
  placed: Placed3D[]
  expansionIndex: number
}): void {
  const {
    gridSizes,
    initialCellRatio,
    maxAspectRatio,
    minSingle,
    minMulti,
    preferMultiLayer,
    maxMultiLayerSpan,
  } = params.options
  const grid = gridSizes[params.gridIndex]!

  // Build hard-placed map once per micro-step (cheap)
  const hardPlacedByLayer = buildHardPlacedByLayer(params)

  // Ensure candidates exist for this grid
  if (params.candidates.length === 0 && params.consumedSeedsThisGrid === 0) {
    params.candidates = computeCandidates3D({
      bounds: params.bounds,
      gridSize: grid,
      layerCount: params.layerCount,
      obstaclesByLayer: params.obstaclesByLayer,
      placedByLayer: params.placedByLayer,
      hardPlacedByLayer,
    })
    params.totalSeedsThisGrid = params.candidates.length
    params.consumedSeedsThisGrid = 0
  }

  // If no candidates remain, advance grid or run edge pass or switch phase
  if (params.candidates.length === 0) {
    if (params.gridIndex + 1 < gridSizes.length) {
      params.gridIndex += 1
      params.totalSeedsThisGrid = 0
      params.consumedSeedsThisGrid = 0
      return
    } else {
      if (!params.edgeAnalysisDone) {
        const minSize = Math.min(minSingle.width, minSingle.height)
        params.candidates = computeEdgeCandidates3D({
          bounds: params.bounds,
          minSize,
          layerCount: params.layerCount,
          obstaclesByLayer: params.obstaclesByLayer,
          placedByLayer: params.placedByLayer,
          hardPlacedByLayer,
        })
        params.edgeAnalysisDone = true
        params.totalSeedsThisGrid = params.candidates.length
        params.consumedSeedsThisGrid = 0
        return
      }
      params.phase = "EXPANSION"
      params.expansionIndex = 0
      return
    }
  }

  // Consume exactly one candidate
  const cand = params.candidates.shift()!
  params.consumedSeedsThisGrid += 1

  // Evaluate attempts — multi-layer span first (computed ignoring soft nodes)
  const span = longestFreeSpanAroundZ({
    x: cand.x,
    y: cand.y,
    z: cand.z,
    layerCount: params.layerCount,
    minSpan: minMulti.minLayers,
    maxSpan: maxMultiLayerSpan,
    obstaclesByLayer: params.obstaclesByLayer,
    placedByLayer: hardPlacedByLayer,
  })

  const attempts: Array<{
    kind: "multi" | "single"
    layers: number[]
    minReq: { width: number; height: number }
  }> = []

  if (span.length >= minMulti.minLayers) {
    attempts.push({
      kind: "multi",
      layers: span,
      minReq: { width: minMulti.width, height: minMulti.height },
    })
  }
  attempts.push({
    kind: "single",
    layers: [cand.z],
    minReq: { width: minSingle.width, height: minSingle.height },
  })

  const ordered = preferMultiLayer ? attempts : attempts.reverse()

  for (const attempt of ordered) {
    // HARD blockers only: obstacles on those layers + full-stack nodes
    const hardBlockers: XYRect[] = []
    for (const z of attempt.layers) {
      if (params.obstaclesByLayer[z])
        hardBlockers.push(...params.obstaclesByLayer[z]!)
      if (hardPlacedByLayer[z]) hardBlockers.push(...hardPlacedByLayer[z]!)
    }

    const rect = expandRectFromSeed({
      startX: cand.x,
      startY: cand.y,
      gridSize: grid,
      bounds: params.bounds,
      blockers: hardBlockers,
      initialCellRatio,
      maxAspectRatio,
      minReq: attempt.minReq,
    })
    if (!rect) continue

    // Place the new node
    const placed: Placed3D = { rect, zLayers: [...attempt.layers] }
    const newIndex = params.placed.push(placed) - 1
    for (const z of attempt.layers) params.placedByLayer[z]!.push(rect)

    // New: carve overlapped soft nodes
    resizeSoftOverlaps(params, newIndex)

    // New: relax candidate culling — only drop seeds that became fully occupied
    params.candidates = params.candidates.filter(
      (c) => !isFullyOccupiedAtPoint(params, { x: c.x, y: c.y }),
    )

    return // processed one candidate
  }

  // Neither attempt worked; drop this candidate for now.
}

/**
 * One micro-step during the EXPANSION phase: expand exactly one placed rect.
 */
export function stepExpansion(params: {
  expansionIndex: number
  placed: Placed3D[]
  options: { gridSizes: number[] }
  obstaclesByLayer: XYRect[][]
  bounds: XYRect
  layerCount: number
  placedByLayer: XYRect[][]
  phase: Phase
}): void {
  if (params.expansionIndex >= params.placed.length) {
    // Transition to gap fill phase instead of done
    params.phase = "GAP_FILL"
    return
  }

  const idx = params.expansionIndex
  const p = params.placed[idx]!
  const lastGrid =
    params.options.gridSizes[params.options.gridSizes.length - 1]!

  const hardPlacedByLayer = buildHardPlacedByLayer(params)

  // HARD blockers only: obstacles on p.zLayers + full-stack nodes
  const hardBlockers: XYRect[] = []
  for (const z of p.zLayers) {
    hardBlockers.push(...(params.obstaclesByLayer[z] ?? []))
    hardBlockers.push(...(hardPlacedByLayer[z] ?? []))
  }

  const oldRect = p.rect
  const expanded = expandRectFromSeed({
    startX: p.rect.x + p.rect.width / 2,
    startY: p.rect.y + p.rect.height / 2,
    gridSize: lastGrid,
    bounds: params.bounds,
    blockers: hardBlockers,
    initialCellRatio: 0,
    maxAspectRatio: null,
    minReq: { width: p.rect.width, height: p.rect.height },
  })

  if (expanded) {
    // Update placement + per-layer index (replace old rect object)
    params.placed[idx] = { rect: expanded, zLayers: p.zLayers }
    for (const z of p.zLayers) {
      const arr = params.placedByLayer[z]!
      const j = arr.findIndex((r) => r === oldRect)
      if (j >= 0) arr[j] = expanded
    }

    // Carve overlapped soft neighbors (respect full-stack nodes)
    resizeSoftOverlaps(params, idx)
  }

  params.expansionIndex += 1
}

/**
 * Finalize placed rectangles into output format.
 */
export function finalizeRects(params: {
  placed: Placed3D[]
  obstaclesByLayer: XYRect[][]
  boardVoidRects: XYRect[]
}): Rect3d[] {
  // Convert all placed (free space) nodes to output format
  const out: Rect3d[] = params.placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))

  /**
   * Recover obstacles as mesh nodes.
   * Obstacles are stored per-layer in `obstaclesByLayer`, but we want to emit
   * single 3D nodes for multi-layer obstacles if they share the same rect.
   * We use the `XYRect` object reference identity to group layers.
   */
  const layersByObstacleRect = new Map<XYRect, number[]>()

  params.obstaclesByLayer.forEach((layerObs, z) => {
    for (const rect of layerObs) {
      const layerIndices = layersByObstacleRect.get(rect) ?? []
      layerIndices.push(z)
      layersByObstacleRect.set(rect, layerIndices)
    }
  })

  // Append obstacle nodes to the output
  const voidSet = new Set(params.boardVoidRects || [])
  for (const [rect, layerIndices] of layersByObstacleRect.entries()) {
    if (voidSet.has(rect)) continue // Skip void rects

    out.push({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
      zLayers: layerIndices.sort((a, b) => a - b),
      isObstacle: true,
    })
  }

  return out
}

/**
 * Calculate rough progress number for BaseSolver.progress.
 */
export function computeProgress(params: {
  options: { gridSizes: number[] }
  phase: Phase
  gridIndex: number
  totalSeedsThisGrid: number
  consumedSeedsThisGrid: number
  placed: Placed3D[]
  expansionIndex: number
}): number {
  const grids = params.options.gridSizes.length
  if (params.phase === "GRID") {
    const g = params.gridIndex
    const base = g / (grids + 1) // reserve final slice for expansion
    const denom = Math.max(1, params.totalSeedsThisGrid)
    const frac = denom ? params.consumedSeedsThisGrid / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }
  if (params.phase === "EXPANSION") {
    const base = grids / (grids + 1)
    const denom = Math.max(1, params.placed.length)
    const frac = denom ? params.expansionIndex / denom : 1
    return Math.min(0.999, base + frac * (1 / (grids + 1)))
  }
  return 1
}
