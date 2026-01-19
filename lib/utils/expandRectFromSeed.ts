import type RBush from "rbush"
import type { XYRect } from "../rectdiff-types"
import { EPS, gt, gte, lt, lte, overlaps } from "./rectdiff-geometry"
import type { RTreeRect } from "lib/types/capacity-mesh-types"
import { isSelfRect } from "./isSelfRect"
import {
  searchStripDown,
  searchStripLeft,
  searchStripRight,
  searchStripUp,
} from "./searchStrip"

type ExpandDirectionParams = {
  r: XYRect
  bounds: XYRect
  blockers: XYRect[]
  maxAspect: number | null | undefined
}

const quantize = (value: number, precision = 1e-6) =>
  Math.round(value / precision) * precision

const quantizeRect = (rect: XYRect): XYRect => ({
  x: quantize(rect.x),
  y: quantize(rect.y),
  width: quantize(rect.width),
  height: quantize(rect.height),
})

function maxExpandRight(params: ExpandDirectionParams) {
  const { r, bounds, blockers, maxAspect } = params
  // Start with board boundary
  let maxWidth = bounds.x + bounds.width - r.x

  // Check all blockers that could limit rightward expansion
  for (const b of blockers) {
    // Only consider blockers that vertically overlap with current rect
    const verticallyOverlaps =
      r.y + r.height > b.y + EPS && b.y + b.height > r.y + EPS
    if (verticallyOverlaps) {
      // Blocker is to the right - limits how far we can expand
      if (gte(b.x, r.x + r.width)) {
        maxWidth = Math.min(maxWidth, b.x - r.x)
      }
      // Blocker overlaps current position - can't expand at all
      else if (
        b.x + b.width > r.x + r.width - EPS &&
        b.x < r.x + r.width + EPS
      ) {
        return 0
      }
    }
  }

  let e = Math.max(0, maxWidth - r.width)
  if (e <= 0) return 0

  // Apply aspect ratio constraint
  if (maxAspect != null) {
    const w = r.width,
      h = r.height
    if (w >= h) e = Math.min(e, maxAspect * h - w)
  }
  return Math.max(0, e)
}

function maxExpandDown(params: ExpandDirectionParams) {
  const { r, bounds, blockers, maxAspect } = params
  // Start with board boundary
  let maxHeight = bounds.y + bounds.height - r.y

  // Check all blockers that could limit downward expansion
  for (const b of blockers) {
    // Only consider blockers that horizontally overlap with current rect
    const horizOverlaps = r.x + r.width > b.x + EPS && b.x + b.width > r.x + EPS
    if (horizOverlaps) {
      // Blocker is below - limits how far we can expand
      if (gte(b.y, r.y + r.height)) {
        maxHeight = Math.min(maxHeight, b.y - r.y)
      }
      // Blocker overlaps current position - can't expand at all
      else if (
        b.y + b.height > r.y + r.height - EPS &&
        b.y < r.y + r.height + EPS
      ) {
        return 0
      }
    }
  }

  let e = Math.max(0, maxHeight - r.height)
  if (e <= 0) return 0

  // Apply aspect ratio constraint
  if (maxAspect != null) {
    const w = r.width,
      h = r.height
    if (h >= w) e = Math.min(e, maxAspect * w - h)
  }
  return Math.max(0, e)
}

function maxExpandLeft(params: ExpandDirectionParams) {
  const { r, bounds, blockers, maxAspect } = params
  // Start with board boundary
  let minX = bounds.x

  // Check all blockers that could limit leftward expansion
  for (const b of blockers) {
    // Only consider blockers that vertically overlap with current rect
    const verticallyOverlaps =
      r.y + r.height > b.y + EPS && b.y + b.height > r.y + EPS
    if (verticallyOverlaps) {
      // Blocker is to the left - limits how far we can expand
      if (lte(b.x + b.width, r.x)) {
        minX = Math.max(minX, b.x + b.width)
      }
      // Blocker overlaps current position - can't expand at all
      else if (b.x < r.x + EPS && b.x + b.width > r.x - EPS) {
        return 0
      }
    }
  }

  let e = Math.max(0, r.x - minX)
  if (e <= 0) return 0

  // Apply aspect ratio constraint
  if (maxAspect != null) {
    const w = r.width,
      h = r.height
    if (w >= h) e = Math.min(e, maxAspect * h - w)
  }
  return Math.max(0, e)
}

function maxExpandUp(params: ExpandDirectionParams) {
  const { r, bounds, blockers, maxAspect } = params
  // Start with board boundary
  let minY = bounds.y

  // Check all blockers that could limit upward expansion
  for (const b of blockers) {
    // Only consider blockers that horizontally overlap with current rect
    const horizOverlaps = r.x + r.width > b.x + EPS && b.x + b.width > r.x + EPS
    if (horizOverlaps) {
      // Blocker is above - limits how far we can expand
      if (lte(b.y + b.height, r.y)) {
        minY = Math.max(minY, b.y + b.height)
      }
      // Blocker overlaps current position - can't expand at all
      else if (b.y < r.y + EPS && b.y + b.height > r.y - EPS) {
        return 0
      }
    }
  }

  let e = Math.max(0, r.y - minY)
  if (e <= 0) return 0

  // Apply aspect ratio constraint
  if (maxAspect != null) {
    const w = r.width,
      h = r.height
    if (h >= w) e = Math.min(e, maxAspect * w - h)
  }
  return Math.max(0, e)
}

const toRect = (tree: RTreeRect): XYRect => ({
  x: tree.minX,
  y: tree.minY,
  width: tree.maxX - tree.minX,
  height: tree.maxY - tree.minY,
})

const addBlocker = (params: {
  rect: XYRect
  seen: Set<string>
  blockers: XYRect[]
}) => {
  const { rect, seen, blockers } = params
  const key = `${rect.x}|${rect.y}|${rect.width}|${rect.height}`
  if (seen.has(key)) return
  seen.add(key)
  blockers.push(rect)
}

const toQueryRect = (params: { bounds: XYRect; rect: XYRect }) => {
  const { bounds, rect } = params
  const minX = Math.max(bounds.x, rect.x)
  const minY = Math.max(bounds.y, rect.y)
  const maxX = Math.min(bounds.x + bounds.width, rect.x + rect.width)
  const maxY = Math.min(bounds.y + bounds.height, rect.y + rect.height)
  if (maxX <= minX + EPS || maxY <= minY + EPS) return null
  return { minX, minY, maxX, maxY }
}

/** Grow a rect around a seed point, honoring bounds/blockers/aspect/min sizes. */
export function expandRectFromSeed(params: {
  startX: number
  startY: number
  gridSize: number
  bounds: XYRect
  obsticalIndexByLayer: Array<RBush<RTreeRect>>
  placedIndexByLayer: Array<RBush<RTreeRect>>
  initialCellRatio: number
  maxAspectRatio: number | null | undefined
  minReq: { width: number; height: number }
  zLayers: number[]
}): XYRect | null {
  const {
    startX,
    startY,
    gridSize,
    bounds,
    obsticalIndexByLayer,
    placedIndexByLayer,
    initialCellRatio,
    maxAspectRatio,
    minReq,
  } = params

  const minSide = Math.max(1e-9, gridSize * initialCellRatio)
  const initialW = Math.max(minSide, minReq.width)
  const initialH = Math.max(minSide, minReq.height)
  const blockers: XYRect[] = []
  const seen = new Set<string>()
  const totalLayers = placedIndexByLayer.length

  // Ignore the existing placement we are expanding so it doesn't self-block.

  const collectBlockers = (searchRect: XYRect) => {
    const query = toQueryRect({ bounds, rect: searchRect })
    if (!query) return
    for (const z of params.zLayers) {
      const blockersIndex = obsticalIndexByLayer[z]
      if (blockersIndex) {
        for (const entry of blockersIndex.search(query))
          addBlocker({ rect: toRect(entry), seen, blockers })
      }

      const placedLayer = placedIndexByLayer[z]
      if (placedLayer) {
        for (const entry of placedLayer.search(query)) {
          const isFullStack = entry.zLayers.length >= totalLayers
          if (!isFullStack) continue
          const rect = toRect(entry)
          if (
            isSelfRect({
              rect,
              startX,
              startY,
              initialW,
              initialH,
            })
          )
            continue
          addBlocker({ rect, seen, blockers })
        }
      }
    }
  }

  const strategies = [
    { ox: 0, oy: 0 },
    { ox: -initialW, oy: 0 },
    { ox: 0, oy: -initialH },
    { ox: -initialW, oy: -initialH },
    { ox: -initialW / 2, oy: -initialH / 2 },
  ]

  let best: XYRect | null = null
  let bestArea = 0

  STRATS: for (const s of strategies) {
    let r: XYRect = {
      x: startX + s.ox,
      y: startY + s.oy,
      width: initialW,
      height: initialH,
    }
    collectBlockers(r)

    // keep initial inside board
    if (
      lt(r.x, bounds.x) ||
      lt(r.y, bounds.y) ||
      gt(r.x + r.width, bounds.x + bounds.width) ||
      gt(r.y + r.height, bounds.y + bounds.height)
    ) {
      continue
    }

    // no initial overlap
    for (const b of blockers) if (overlaps(r, b)) continue STRATS

    // greedy expansions in 4 directions
    // Use a minimum expansion threshold to avoid infinitesimal improvements
    // that can occur with mixed-precision floating point coordinates
    const MIN_EXPANSION = 1e-6
    const MAX_ITERATIONS = 1000
    let improved = true
    let iterations = 0
    while (improved && iterations < MAX_ITERATIONS) {
      iterations++
      improved = false
      const commonParams = { bounds, blockers, maxAspect: maxAspectRatio }

      collectBlockers(searchStripRight({ rect: r, bounds }))
      const eR = maxExpandRight({ ...commonParams, r })
      if (eR > MIN_EXPANSION) {
        r = { ...r, width: r.width + eR }
        collectBlockers(r)
        improved = true
      }

      collectBlockers(searchStripDown({ rect: r, bounds }))
      const eD = maxExpandDown({ ...commonParams, r })
      if (eD > MIN_EXPANSION) {
        r = { ...r, height: r.height + eD }
        collectBlockers(r)
        improved = true
      }

      collectBlockers(searchStripLeft({ rect: r, bounds }))
      const eL = maxExpandLeft({ ...commonParams, r })
      if (eL > MIN_EXPANSION) {
        r = { x: r.x - eL, y: r.y, width: r.width + eL, height: r.height }
        collectBlockers(r)
        improved = true
      }

      collectBlockers(searchStripUp({ rect: r, bounds }))
      const eU = maxExpandUp({ ...commonParams, r })
      if (eU > MIN_EXPANSION) {
        r = { x: r.x, y: r.y - eU, width: r.width, height: r.height + eU }
        collectBlockers(r)
        improved = true
      }
    }

    if (r.width + EPS >= minReq.width && r.height + EPS >= minReq.height) {
      const area = r.width * r.height
      if (area > bestArea) {
        best = quantizeRect(r)
        bestArea = area
      }
    }
  }

  return best
}
