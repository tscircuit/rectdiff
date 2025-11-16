// lib/solvers/RectDiffSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson, Obstacle } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"

/** ---------------------------------------------------------------------
 *  Types carried over from the existing file
 *  (Rect3d + solver output types)
 *  ------------------------------------------------------------------ */
type Rect3d = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  zLayers: number[] // integer z indices (contiguous)
}

/** ---------------------------------------------------------------------
 *  NEW: Grid-based 3D filler (rect-fill-2d.tsx generalized to 3D)
 *  ------------------------------------------------------------------ */

/** Simple 2D rect (XY only) */
type XYRect = { x: number; y: number; width: number; height: number }

/** Options controlling the grid-filler behavior */
export type GridFill3DOptions = {
  /** Grid sizes (largest -> smallest). Units: same as SRJ bounds (typically mm). */
  gridSizes?: number[]
  /** For the very first seed rect at a grid point, we start with (gridSize * initialCellRatio) square. */
  initialCellRatio?: number // default 0.2 like the 2D experiment

  /** Aspect-ratio cap (w/h or h/w). If undefined or null, no cap (final expansion ignores it anyway). */
  maxAspectRatio?: number | null

  /** Single-layer minimum rectangle requirements. */
  minSingle: { width: number; height: number }

  /** Multi-layer minimum requirements + minimum contiguous layer span */
  minMulti: { width: number; height: number; minLayers: number }

  /** Prefer multi-layer candidate before single-layer? (Required by request) */
  preferMultiLayer?: boolean

  /** Optional cap for multi-layer span when expanding vertically across Z. Default: no cap. */
  maxMultiLayerSpan?: number
}

/** Internal numeric helpers */
const EPS = 1e-9
const gt = (a: number, b: number) => a > b + EPS
const gte = (a: number, b: number) => a > b - EPS
const lt = (a: number, b: number) => a < b - EPS
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))

/** Geometry helpers (XY) */
function overlaps(a: XYRect, b: XYRect) {
  return !(
    a.x + a.width <= b.x + EPS ||
    b.x + b.width <= a.x + EPS ||
    a.y + a.height <= b.y + EPS ||
    b.y + b.height <= a.y + EPS
  )
}
function containsPoint(r: XYRect, x: number, y: number) {
  return (
    x >= r.x - EPS &&
    x <= r.x + r.width + EPS &&
    y >= r.y - EPS &&
    y <= r.y + r.height + EPS
  )
}
function distancePointToRectEdges(px: number, py: number, r: XYRect) {
  // Distance to the 4 edges (segments). For ranking seed points.
  const edges: [number, number, number, number][] = [
    [r.x, r.y, r.x + r.width, r.y], // top
    [r.x + r.width, r.y, r.x + r.width, r.y + r.height], // right
    [r.x + r.width, r.y + r.height, r.x, r.y + r.height], // bottom
    [r.x, r.y + r.height, r.x, r.y], // left
  ]
  let best = Infinity
  for (const [x1, y1, x2, y2] of edges) {
    const A = px - x1
    const B = py - y1
    const C = x2 - x1
    const D = y2 - y1
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = lenSq !== 0 ? dot / lenSq : -1
    if (param < 0) param = 0
    else if (param > 1) param = 1
    const xx = x1 + param * C
    const yy = y1 + param * D
    const dx = px - xx
    const dy = py - yy
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}

/** Axis-aligned blockers set => get maximum expansion amounts in each direction */
function maxExpandRight(
  rect: XYRect,
  bounds: XYRect,
  blockers: XYRect[],
  maxAspect: number | null | undefined,
) {
  // limit by board
  let maxWidth = bounds.x + bounds.width - rect.x
  // limit by blockers to the right that vertically overlap rect
  for (const b of blockers) {
    if (
      rect.y + rect.height > b.y + EPS &&
      b.y + b.height > rect.y + EPS &&
      gte(b.x, rect.x + rect.width) // blocker entirely to the right
    ) {
      maxWidth = Math.min(maxWidth, b.x - rect.x)
    }
  }
  let expansion = Math.max(0, maxWidth - rect.width)
  if (expansion <= 0) return 0

  if (maxAspect != null) {
    const w = rect.width
    const h = rect.height
    if (w >= h) {
      // ratio = (w + e) / h  <= maxAspect
      expansion = Math.min(expansion, maxAspect * h - w)
    } else {
      // ratio = h / (w + e) — increasing w only helps
      // no further cap
    }
  }

  return Math.max(0, expansion)
}

function maxExpandDown(
  rect: XYRect,
  bounds: XYRect,
  blockers: XYRect[],
  maxAspect: number | null | undefined,
) {
  let maxHeight = bounds.y + bounds.height - rect.y
  for (const b of blockers) {
    if (
      rect.x + rect.width > b.x + EPS &&
      b.x + b.width > rect.x + EPS &&
      gte(b.y, rect.y + rect.height)
    ) {
      maxHeight = Math.min(maxHeight, b.y - rect.y)
    }
  }
  let expansion = Math.max(0, maxHeight - rect.height)
  if (expansion <= 0) return 0

  if (maxAspect != null) {
    const w = rect.width
    const h = rect.height
    if (h >= w) {
      // ratio = (h + e) / w <= maxAspect
      expansion = Math.min(expansion, maxAspect * w - h)
    } else {
      // ratio = w / (h + e) — increasing h only helps
    }
  }

  return Math.max(0, expansion)
}

function maxExpandLeft(
  rect: XYRect,
  bounds: XYRect,
  blockers: XYRect[],
  maxAspect: number | null | undefined,
) {
  let minX = bounds.x
  for (const b of blockers) {
    if (
      rect.y + rect.height > b.y + EPS &&
      b.y + b.height > rect.y + EPS &&
      lte(b.x + b.width, rect.x) // blocker entirely to the left
    ) {
      minX = Math.max(minX, b.x + b.width)
    }
  }
  let expansion = Math.max(0, rect.x - minX)
  if (expansion <= 0) return 0

  if (maxAspect != null) {
    const w = rect.width
    const h = rect.height
    // Expanding left increases width as well
    if (w >= h) {
      expansion = Math.min(expansion, maxAspect * h - w)
    } else {
      // increasing w when w<h reduces ratio automatically
    }
  }

  return Math.max(0, expansion)
}

function maxExpandUp(
  rect: XYRect,
  bounds: XYRect,
  blockers: XYRect[],
  maxAspect: number | null | undefined,
) {
  let minY = bounds.y
  for (const b of blockers) {
    if (
      rect.x + rect.width > b.x + EPS &&
      b.x + b.width > rect.x + EPS &&
      lte(b.y + b.height, rect.y) // blocker entirely above
    ) {
      minY = Math.max(minY, b.y + b.height)
    }
  }
  let expansion = Math.max(0, rect.y - minY)
  if (expansion <= 0) return 0

  if (maxAspect != null) {
    const w = rect.width
    const h = rect.height
    // Expanding up increases height as well
    if (h >= w) {
      expansion = Math.min(expansion, maxAspect * w - h)
    } else {
      // increasing h when h<w reduces ratio automatically
    }
  }

  return Math.max(0, expansion)
}

function lte(a: number, b: number) {
  return a < b + EPS
}

/** Try to build the best axis-aligned rect around (startX, startY) by expanding in place. */
function expandRectFromSeed(
  startX: number,
  startY: number,
  gridSize: number,
  bounds: XYRect,
  blockers: XYRect[],
  initialCellRatio: number,
  maxAspectRatio: number | null | undefined,
  minReq: { width: number; height: number },
): XYRect | null {
  const minSide = Math.max(1e-9, gridSize * initialCellRatio)
  const initialW = Math.max(minSide, minReq.width)
  const initialH = Math.max(minSide, minReq.height)

  const strategies = [
    { ox: 0, oy: 0 }, // seed at top-left
    { ox: -initialW, oy: 0 }, // top-right
    { ox: 0, oy: -initialH }, // bottom-left
    { ox: -initialW, oy: -initialH }, // bottom-right
    { ox: -initialW / 2, oy: -initialH / 2 }, // centered
  ]

  let best: XYRect | null = null
  let bestArea = 0

  for (const s of strategies) {
    // start rect
    let r: XYRect = {
      x: startX + s.ox,
      y: startY + s.oy,
      width: initialW,
      height: initialH,
    }

    // keep initial inside bounds, otherwise skip
    if (
      lt(r.x, bounds.x) ||
      lt(r.y, bounds.y) ||
      gt(r.x + r.width, bounds.x + bounds.width) ||
      gt(r.y + r.height, bounds.y + bounds.height)
    ) {
      continue
    }

    // initial must not overlap any blocker
    if (blockers.some((b) => overlaps(r, b))) continue

    let improved = true
    while (improved) {
      improved = false

      // expand in each direction up to the next blocker or boundary
      const eR = maxExpandRight(r, bounds, blockers, maxAspectRatio)
      if (eR > 0) {
        r = { ...r, width: r.width + eR }
        improved = true
      }

      const eD = maxExpandDown(r, bounds, blockers, maxAspectRatio)
      if (eD > 0) {
        r = { ...r, height: r.height + eD }
        improved = true
      }

      const eL = maxExpandLeft(r, bounds, blockers, maxAspectRatio)
      if (eL > 0) {
        r = { x: r.x - eL, y: r.y, width: r.width + eL, height: r.height }
        improved = true
      }

      const eU = maxExpandUp(r, bounds, blockers, maxAspectRatio)
      if (eU > 0) {
        r = { x: r.x, y: r.y - eU, width: r.width, height: r.height + eU }
        improved = true
      }
    }

    // check minimums one last time
    if (r.width + EPS >= minReq.width && r.height + EPS >= minReq.height) {
      const area = r.width * r.height
      if (area > bestArea) {
        best = r
        bestArea = area
      }
    }
  }

  return best
}

/** ---------------------------------------------------------------------
 *  Obstacles-to-layers mapping
 *  ------------------------------------------------------------------ */

function layerSortKey(n: string) {
  const L = n.toLowerCase()
  if (L === "top") return -1_000_000
  if (L === "bottom") return 1_000_000
  const m = /^inner(\d+)$/i.exec(L)
  if (m) return parseInt(m[1]!, 10) || 0
  return 100 + L.charCodeAt(0)
}
function canonicalizeLayerOrder(names: string[]) {
  return Array.from(new Set(names)).sort((a, b) => {
    const ka = layerSortKey(a)
    const kb = layerSortKey(b)
    if (ka !== kb) return ka - kb
    return a.localeCompare(b)
  })
}
function buildZIndexMap(srj: SimpleRouteJson) {
  // Prefer names from SRJ obstacles (covers nearly all boards)
  const names = canonicalizeLayerOrder(
    (srj.obstacles ?? []).flatMap((o) => o.layers ?? []),
  )
  const fallback = Array.from(
    { length: Math.max(1, srj.layerCount || 1) },
    (_, i) =>
      i === 0
        ? "top"
        : i === (srj.layerCount || 1) - 1
          ? "bottom"
          : `inner${i}`,
  )
  const layerNames = names.length ? names : fallback
  const map = new Map<string, number>()
  for (let i = 0; i < layerNames.length; i++) {
    map.set(layerNames[i]!, i)
  }
  return { layerNames, zIndexByName: map }
}

function obstacleZs(ob: Obstacle, zIndexByName: Map<string, number>) {
  if (ob.zLayers?.length) {
    // Provided numerically
    return Array.from(new Set(ob.zLayers)).sort((a, b) => a - b)
  }
  const fromNames = (ob.layers ?? [])
    .map((n) => zIndexByName.get(n))
    .filter((v): v is number => typeof v === "number")
  return Array.from(new Set(fromNames)).sort((a, b) => a - b)
}

function obstacleToXYRect(ob: Obstacle): XYRect | null {
  // For "rect" use as-is; for "oval" approximate by its bounding rect (width/height are provided)
  const w = ob.width as any
  const h = ob.height as any
  // Some SRJ test data contains type:"oval" which includes width/height; use bounding box
  if (typeof w !== "number" || typeof h !== "number") return null
  return {
    x: ob.center.x - w / 2,
    y: ob.center.y - h / 2,
    width: w,
    height: h,
  }
}

/** ---------------------------------------------------------------------
 *  Seed candidates (3D grid)
 *  ------------------------------------------------------------------ */

function computeCandidates3D(
  bounds: XYRect,
  gridSize: number,
  layerCount: number,
  obstaclesByLayer: XYRect[][],
  placedByLayer: XYRect[][],
) {
  // For scoring, distance is computed on the layer the point is on.
  type Cand = { x: number; y: number; z: number; distance: number }
  const out: Cand[] = []

  for (let z = 0; z < layerCount; z++) {
    const blockers = [
      ...(obstaclesByLayer[z] ?? []),
      ...(placedByLayer[z] ?? []),
    ]

    for (let x = bounds.x; x < bounds.x + bounds.width; x += gridSize) {
      for (let y = bounds.y; y < bounds.y + bounds.height; y += gridSize) {
        // skip the last row/col touching the outer frame to avoid edge-only seeds
        if (
          Math.abs(x - bounds.x) < EPS ||
          Math.abs(y - bounds.y) < EPS ||
          x > bounds.x + bounds.width - gridSize - EPS ||
          y > bounds.y + bounds.height - gridSize - EPS
        ) {
          continue
        }

        let inside = false
        for (const b of blockers) {
          if (containsPoint(b, x, y)) {
            inside = true
            // Fast skip down rows for large blockers: jump to near the bottom of the blocker
            const bottom = b.y + b.height
            const remaining = bottom - y
            const skipSteps = Math.max(0, Math.floor(remaining / gridSize))
            if (skipSteps > 0) {
              // inner loop will add another +gridSize
              y += (skipSteps - 1) * gridSize
            }
            break
          }
        }
        if (inside) continue

        // Distance to nearest blocker or the board edges (on this layer)
        const d = Math.min(
          distancePointToRectEdges(x, y, bounds),
          ...(blockers.length
            ? blockers.map((b) => distancePointToRectEdges(x, y, b))
            : [Infinity]),
        )

        out.push({ x, y, z, distance: d })
      }
    }
  }

  // Prioritize emptier areas first
  out.sort((a, b) => b.distance - a.distance)
  return out
}

/** ---------------------------------------------------------------------
 *  Multi-layer span around a seed
 *  ------------------------------------------------------------------ */

function longestFreeSpanAroundZ(
  x: number,
  y: number,
  z: number,
  layerCount: number,
  minSpan: number,
  maxSpan: number | undefined,
  obstaclesByLayer: XYRect[][],
  placedByLayer: XYRect[][],
): number[] {
  // Grow around z as [z0..z1] while the seed point is free in every layer.
  const isFreeAt = (layer: number) => {
    const blockers = [
      ...(obstaclesByLayer[layer] ?? []),
      ...(placedByLayer[layer] ?? []),
    ]
    return !blockers.some((b) => containsPoint(b, x, y))
  }

  let lo = z
  let hi = z
  while (lo - 1 >= 0 && isFreeAt(lo - 1)) lo--
  while (hi + 1 < layerCount && isFreeAt(hi + 1)) hi++

  const span = { lo, hi }
  if (typeof maxSpan === "number") {
    // tighten to respect maxSpan while keeping z inside
    const target = clamp(maxSpan, 1, layerCount)
    let width = hi - lo + 1
    while (width > target) {
      // trim alternately
      if (z - lo > hi - z) lo++
      else hi--
      width = hi - lo + 1
    }
  }

  const res: number[] = []
  for (let i = span.lo; i <= span.hi; i++) res.push(i)
  if (res.length < minSpan) return []
  return res
}

/** ---------------------------------------------------------------------
 *  Main grid fill
 *  ------------------------------------------------------------------ */

function gridFill3D(srj: SimpleRouteJson, opts: GridFill3DOptions): Rect3d[] {
  const { layerNames, zIndexByName } = buildZIndexMap(srj)
  const layerCount = Math.max(1, layerNames.length, srj.layerCount || 1)

  const bounds: XYRect = {
    x: srj.bounds.minX,
    y: srj.bounds.minY,
    width: srj.bounds.maxX - srj.bounds.minX,
    height: srj.bounds.maxY - srj.bounds.minY,
  }

  // Build blockers per layer from SRJ obstacles
  const obstaclesByLayer: XYRect[][] = Array.from(
    { length: layerCount },
    () => [],
  )
  for (const ob of srj.obstacles ?? []) {
    const r = obstacleToXYRect(ob)
    if (!r) continue
    const zs = obstacleZs(ob, zIndexByName)
    for (const z of zs) {
      const layer = obstaclesByLayer[z]
      if (z >= 0 && z < layerCount && layer) layer.push(r)
    }
  }

  const {
    gridSizes = computeDefaultGridSizes(bounds),
    initialCellRatio = 0.2,
    maxAspectRatio = 2, // tolerable initial ratio; final pass ignores it
    minSingle,
    minMulti,
    preferMultiLayer = true,
    maxMultiLayerSpan,
  } = opts

  const placed: { rect: XYRect; zLayers: number[] }[] = []
  const placedByLayer: XYRect[][] = Array.from({ length: layerCount }, () => [])

  // Phase 1: process all grid sizes (coarse -> fine)
  for (const grid of gridSizes) {
    let candidates = computeCandidates3D(
      bounds,
      grid,
      layerCount,
      obstaclesByLayer,
      placedByLayer,
    )

    while (candidates.length > 0) {
      const cand = candidates[0]
      if (!cand) break
      candidates = candidates.slice(1)

      // Assemble blockers for current layer or span
      const tryMultiFirst = preferMultiLayer
      const attempts: Array<{
        kind: "multi" | "single"
        layers: number[]
        minReq: { width: number; height: number }
      }> = []

      // Multi-layer attempt (use the longest free contiguous span that contains cand.z)
      const span = longestFreeSpanAroundZ(
        cand.x,
        cand.y,
        cand.z,
        layerCount,
        minMulti.minLayers,
        maxMultiLayerSpan,
        obstaclesByLayer,
        placedByLayer,
      )
      if (span.length >= minMulti.minLayers) {
        attempts.push({
          kind: "multi",
          layers: span,
          minReq: { width: minMulti.width, height: minMulti.height },
        })
      }

      // Single-layer attempt
      attempts.push({
        kind: "single",
        layers: [cand.z],
        minReq: { width: minSingle.width, height: minSingle.height },
      })

      const ordered = tryMultiFirst ? attempts : attempts.reverse()

      let accepted = false
      for (const attempt of ordered) {
        // Union blockers across all target layers
        const blockers: XYRect[] = []
        for (const z of attempt.layers) {
          const obs = obstaclesByLayer[z]
          const pl = placedByLayer[z]
          if (obs) blockers.push(...obs)
          if (pl) blockers.push(...pl)
        }

        const rect = expandRectFromSeed(
          cand.x,
          cand.y,
          grid,
          bounds,
          blockers,
          initialCellRatio,
          maxAspectRatio,
          attempt.minReq,
        )

        if (!rect) continue

        // Place it
        placed.push({ rect, zLayers: attempt.layers.slice() })
        for (const z of attempt.layers) {
          const pl = placedByLayer[z]
          if (pl) pl.push(rect)
        }

        // Remove future candidates that fell inside this rect on any of the used layers
        candidates = candidates.filter(
          (c) =>
            !attempt.layers.includes(c.z) || !containsPoint(rect, c.x, c.y),
        )

        accepted = true
        break
      }

      // If nothing accepted from this seed, move on to the next candidate
      if (!accepted) continue
    }
  }

  // Phase 2: global expansion pass (remove aspect constraint, expand against placed set)
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i]
    if (!p) continue

    // Build blockers as: all obstacles on used layers + all other placed rects on those layers
    const blockers: XYRect[] = []
    for (const z of p.zLayers) {
      const obs = obstaclesByLayer[z]
      if (obs) blockers.push(...obs)
    }
    for (let j = 0; j < placed.length; j++) {
      if (i === j) continue
      const other = placed[j]
      if (!other) continue
      // only block on intersecting layers
      if (other.zLayers.some((z) => p.zLayers.includes(z))) {
        blockers.push(other.rect)
      }
    }

    const lastGrid = gridSizes[gridSizes.length - 1]
    if (!lastGrid) continue

    const expanded = expandRectFromSeed(
      p.rect.x + p.rect.width / 2,
      p.rect.y + p.rect.height / 2,
      lastGrid,
      bounds,
      blockers,
      /* initialCellRatio */ 0, // we already have a rect; we don't want to bias the anchor
      /* maxAspectRatio   */ null,
      /* minReq */ { width: p.rect.width, height: p.rect.height },
    )
    if (expanded) {
      placed[i] = { rect: expanded, zLayers: p.zLayers }
    }
  }

  // Produce Rect3d[]
  const rects: Rect3d[] = placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: p.zLayers.slice().sort((a, b) => a - b),
  }))

  return rects
}

function computeDefaultGridSizes(bounds: XYRect): number[] {
  // Heuristic: start coarsely, end fine; scale with board size
  const ref = Math.max(bounds.width, bounds.height)
  // 8 → 16 → 32 slices across the larger dimension
  const g1 = ref / 8
  const g2 = ref / 16
  const g3 = ref / 32
  return [g1, g2, g3]
}

/** ---------------------------------------------------------------------
 *  Solver class
 *  ------------------------------------------------------------------ */

export class RectDiffSolver extends BaseSolver {
  private srj: SimpleRouteJson
  private mode: "grid" | "exact"
  private gridOptions: GridFill3DOptions
  private _meshNodes: CapacityMeshNode[] = []

  constructor(opts: {
    simpleRouteJson: SimpleRouteJson
    mode?: "grid" | "exact"
    gridOptions?: Partial<GridFill3DOptions>
  }) {
    super()
    this.srj = opts.simpleRouteJson
    this.mode = opts.mode ?? "grid"

    // sensible defaults; note min* are intentionally easy to read/tune from SRJ
    const trace = Math.max(0.01, this.srj.minTraceWidth || 0.15)
    this.gridOptions = {
      initialCellRatio: 0.2,
      maxAspectRatio: 3,
      minSingle: { width: 2 * trace, height: 2 * trace },
      minMulti: {
        width: 4 * trace,
        height: 4 * trace,
        minLayers: Math.min(2, Math.max(1, this.srj.layerCount || 1)),
      },
      preferMultiLayer: true,
      ...opts.gridOptions,
    }
  }

  // override _step() {
  //   // TODO implement one iteration of the algorithm, process one candidate,
  //   // expand one dimension of a rect etc. Do a very small thing
  // }

  // BAD!!!!! DO NOT OVERRIDE SOLVE! PERFORM ONE ITERATION PER STEP!
  override solve() {
    if (this.mode === "grid") {
      const rects = gridFill3D(this.srj, this.gridOptions)
      this._meshNodes = rectsToMeshNodes(rects)
    } else {
      // If you want to keep the exact-diff/coalescing path around:
      // const rects = exactDiff3D(this.srj, { ... })
      // this._meshNodes = rectsToMeshNodes(rects)
      const rects = gridFill3D(this.srj, this.gridOptions) // fallback to grid
      this._meshNodes = rectsToMeshNodes(rects)
    }
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    return { meshNodes: this._meshNodes }
  }

  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []

    // Board outline
    rects.push({
      center: {
        x: (this.srj.bounds.minX + this.srj.bounds.maxX) / 2,
        y: (this.srj.bounds.minY + this.srj.bounds.maxY) / 2,
      },
      width: this.srj.bounds.maxX - this.srj.bounds.minX,
      height: this.srj.bounds.maxY - this.srj.bounds.minY,
      fill: "none",
      stroke: "#111827",
      label: "board",
    })

    // Obstacles on all layers — red translucent
    for (const ob of this.srj.obstacles ?? []) {
      if (ob.type === "rect" || ob.type === "oval") {
        rects.push({
          center: { x: ob.center.x, y: ob.center.y },
          width: ob.width,
          height: ob.height,
          fill: "#fee2e2",
          stroke: "#ef4444",
          layer: "obstacle",
          label: ["obstacle", ob.zLayers?.join(",")].join("\n"),
        })
      }
    }

    // Capacity nodes on all layers — green translucent
    if (this._meshNodes.length > 0) {
      // Sort for deterministic ordering
      const sortedNodes = [...this._meshNodes].sort(
        (a, b) =>
          a.center.x - b.center.x ||
          a.center.y - b.center.y ||
          a.width - b.width ||
          a.height - b.height ||
          a.layer.localeCompare(b.layer),
      )

      for (const node of sortedNodes) {
        // Format zLayers as a comma-separated string
        const zLayersStr = node.availableZ.join(",")
        rects.push({
          center: { x: node.center.x, y: node.center.y },
          width: node.width,
          height: node.height,
          fill: "#d1fae5",
          stroke: "#10b981",
          layer: node.layer,
          label: `free\nz:${zLayersStr}`,
        })
      }
    }

    return {
      title: "RectDiff (all layers)",
      coordinateSystem: "cartesian",
      rects,
    }
  }
}

/** Convert Rect3d[] to CapacityMeshNode[] for 3D viewer */
function rectsToMeshNodes(rects: Rect3d[]): CapacityMeshNode[] {
  let id = 0
  const nodes: CapacityMeshNode[] = []
  for (const r of rects) {
    const cx = (r.minX + r.maxX) / 2
    const cy = (r.minY + r.maxY) / 2
    const w = Math.max(0, r.maxX - r.minX)
    const h = Math.max(0, r.maxY - r.minY)
    if (w <= 0 || h <= 0 || r.zLayers.length === 0) continue

    nodes.push({
      capacityMeshNodeId: `cmn_${id++}`,
      center: { x: cx, y: cy },
      width: w,
      height: h,
      // layer name is not used by the 3D view to merge prisms; availableZ drives Z spans.
      layer: "top",
      availableZ: r.zLayers.slice(),
    })
  }
  return nodes
}
