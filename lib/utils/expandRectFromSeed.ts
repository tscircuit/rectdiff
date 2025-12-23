import type { XYRect } from "../rectdiff-types"
import { EPS, gt, gte, lt, lte, overlaps } from "./rectdiff-geometry"

type ExpandDirectionParams = {
  r: XYRect
  bounds: XYRect
  blockers: XYRect[]
  maxAspect: number | null | undefined
}

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

/** Grow a rect around a seed point, honoring bounds/blockers/aspect/min sizes. */
export function expandRectFromSeed(params: {
  startX: number
  startY: number
  gridSize: number
  bounds: XYRect
  blockers: XYRect[]
  initialCellRatio: number
  maxAspectRatio: number | null | undefined
  minReq: { width: number; height: number }
}): XYRect | null {
  const {
    startX,
    startY,
    gridSize,
    bounds,
    blockers,
    initialCellRatio,
    maxAspectRatio,
    minReq,
  } = params

  const minSide = Math.max(1e-9, gridSize * initialCellRatio)
  const initialW = Math.max(minSide, minReq.width)
  const initialH = Math.max(minSide, minReq.height)

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
    let improved = true
    while (improved) {
      improved = false
      const commonParams = { bounds, blockers, maxAspect: maxAspectRatio }
      
      const eR = maxExpandRight({ ...commonParams, r })
      if (eR > 0) {
        r = { ...r, width: r.width + eR }
        improved = true
      }

      const eD = maxExpandDown({ ...commonParams, r })
      if (eD > 0) {
        r = { ...r, height: r.height + eD }
        improved = true
      }

      const eL = maxExpandLeft({ ...commonParams, r })
      if (eL > 0) {
        r = { x: r.x - eL, y: r.y, width: r.width + eL, height: r.height }
        improved = true
      }

      const eU = maxExpandUp({ ...commonParams, r })
      if (eU > 0) {
        r = { x: r.x, y: r.y - eU, width: r.width, height: r.height + eU }
        improved = true
      }
    }

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
