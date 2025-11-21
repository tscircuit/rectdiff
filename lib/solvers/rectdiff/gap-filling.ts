// lib/solvers/rectdiff/gap-filling.ts
import type { Placed3D, XYRect, RectDiffState } from "./types"
import { EPS, overlaps } from "./geometry"

interface AdjacentPair {
  idx1: number
  idx2: number
  gap: number
  direction: "horizontal" | "vertical"
  // For horizontal: node1 is left, node2 is right
  // For vertical: node1 is top, node2 is bottom
}

/**
 * Find pairs of adjacent nodes that share layers and have a fillable gap between them
 */
function findAdjacentPairsWithGaps(
  state: RectDiffState,
): AdjacentPair[] {
  const pairs: AdjacentPair[] = []
  const placed = state.placed

  for (let i = 0; i < placed.length; i++) {
    const p1 = placed[i]!
    for (let j = i + 1; j < placed.length; j++) {
      const p2 = placed[j]!

      // Check if they share any layers
      const sharedLayers = p1.zLayers.filter((z) => p2.zLayers.includes(z))
      if (sharedLayers.length === 0) continue

      const r1 = p1.rect
      const r2 = p2.rect

      // Check horizontal adjacency (aligned vertically, separated horizontally)
      const verticalOverlap = Math.min(
        r1.y + r1.height,
        r2.y + r2.height,
      ) - Math.max(r1.y, r2.y)

      if (verticalOverlap > EPS) {
        // Check if r1 is to the left of r2
        const gap1 = r2.x - (r1.x + r1.width)
        if (gap1 > EPS && gap1 < state.srj.minTraceWidth * 2) {
          pairs.push({
            idx1: i,
            idx2: j,
            gap: gap1,
            direction: "horizontal",
          })
          continue
        }

        // Check if r2 is to the left of r1
        const gap2 = r1.x - (r2.x + r2.width)
        if (gap2 > EPS && gap2 < state.srj.minTraceWidth * 2) {
          pairs.push({
            idx1: j,
            idx2: i,
            gap: gap2,
            direction: "horizontal",
          })
          continue
        }
      }

      // Check vertical adjacency (aligned horizontally, separated vertically)
      const horizontalOverlap = Math.min(
        r1.x + r1.width,
        r2.x + r2.width,
      ) - Math.max(r1.x, r2.x)

      if (horizontalOverlap > EPS) {
        // Check if r1 is above r2
        const gap1 = r2.y - (r1.y + r1.height)
        if (gap1 > EPS && gap1 < state.srj.minTraceWidth * 2) {
          pairs.push({
            idx1: i,
            idx2: j,
            gap: gap1,
            direction: "vertical",
          })
          continue
        }

        // Check if r2 is above r1
        const gap2 = r1.y - (r2.y + r2.height)
        if (gap2 > EPS && gap2 < state.srj.minTraceWidth * 2) {
          pairs.push({
            idx1: j,
            idx2: i,
            gap: gap2,
            direction: "vertical",
          })
        }
      }
    }
  }

  return pairs
}

/**
 * Check if shrinking a rect by a given amount in a direction would violate minimum size
 */
function canShrink(
  rect: XYRect,
  amount: number,
  direction: "horizontal" | "vertical",
  minSize: { width: number; height: number },
): boolean {
  if (direction === "horizontal") {
    return rect.width - amount >= minSize.width - EPS
  } else {
    return rect.height - amount >= minSize.height - EPS
  }
}

/**
 * Check if adjusting a node would cause it to overlap with any obstacles or other nodes
 */
function wouldCauseOverlap(
  adjustedRect: XYRect,
  nodeIndex: number,
  zLayers: number[],
  state: RectDiffState,
): boolean {
  // Check obstacles
  for (const z of zLayers) {
    const obstacles = state.obstaclesByLayer[z] ?? []
    for (const obs of obstacles) {
      if (overlaps(adjustedRect, obs)) return true
    }
  }

  // Check other placed nodes
  for (let i = 0; i < state.placed.length; i++) {
    if (i === nodeIndex) continue
    const other = state.placed[i]!

    // Check if they share layers
    const sharedLayers = zLayers.filter((z) => other.zLayers.includes(z))
    if (sharedLayers.length === 0) continue

    if (overlaps(adjustedRect, other.rect)) return true
  }

  return false
}

/**
 * Attempt to fill gaps between adjacent nodes by adjusting their sizes
 */
export function fillAdjacentNodeGaps(state: RectDiffState): void {
  const pairs = findAdjacentPairsWithGaps(state)

  const minSize = {
    width: Math.min(
      state.options.minSingle.width,
      state.options.minMulti.width,
    ),
    height: Math.min(
      state.options.minSingle.height,
      state.options.minMulti.height,
    ),
  }

  for (const pair of pairs) {
    const p1 = state.placed[pair.idx1]!
    const p2 = state.placed[pair.idx2]!
    const gap = pair.gap

    // Try splitting the gap: shrink node1 and grow node2
    const adjustment = gap / 2

    if (pair.direction === "horizontal") {
      // Node1 is left, node2 is right
      // Try shrinking node1 from the right, growing node2 from the left
      if (canShrink(p1.rect, adjustment, "horizontal", minSize)) {
        const newR1: XYRect = {
          ...p1.rect,
          width: p1.rect.width - adjustment,
        }
        const newR2: XYRect = {
          x: p2.rect.x - adjustment,
          y: p2.rect.y,
          width: p2.rect.width + adjustment,
          height: p2.rect.height,
        }

        // Check if these adjustments would cause overlaps
        if (
          !wouldCauseOverlap(newR1, pair.idx1, p1.zLayers, state) &&
          !wouldCauseOverlap(newR2, pair.idx2, p2.zLayers, state)
        ) {
          // Apply the adjustments
          updatePlacedRect(state, pair.idx1, newR1)
          updatePlacedRect(state, pair.idx2, newR2)
          continue
        }
      }

      // Try alternative: just grow node2 to fill the gap
      const newR2Alt: XYRect = {
        x: p2.rect.x - gap,
        y: p2.rect.y,
        width: p2.rect.width + gap,
        height: p2.rect.height,
      }
      if (!wouldCauseOverlap(newR2Alt, pair.idx2, p2.zLayers, state)) {
        updatePlacedRect(state, pair.idx2, newR2Alt)
        continue
      }

      // Try alternative: just grow node1 to fill the gap
      const newR1Alt: XYRect = {
        ...p1.rect,
        width: p1.rect.width + gap,
      }
      if (!wouldCauseOverlap(newR1Alt, pair.idx1, p1.zLayers, state)) {
        updatePlacedRect(state, pair.idx1, newR1Alt)
      }
    } else {
      // Node1 is top, node2 is bottom
      // Try shrinking node1 from the bottom, growing node2 from the top
      if (canShrink(p1.rect, adjustment, "vertical", minSize)) {
        const newR1: XYRect = {
          ...p1.rect,
          height: p1.rect.height - adjustment,
        }
        const newR2: XYRect = {
          x: p2.rect.x,
          y: p2.rect.y - adjustment,
          width: p2.rect.width,
          height: p2.rect.height + adjustment,
        }

        // Check if these adjustments would cause overlaps
        if (
          !wouldCauseOverlap(newR1, pair.idx1, p1.zLayers, state) &&
          !wouldCauseOverlap(newR2, pair.idx2, p2.zLayers, state)
        ) {
          // Apply the adjustments
          updatePlacedRect(state, pair.idx1, newR1)
          updatePlacedRect(state, pair.idx2, newR2)
          continue
        }
      }

      // Try alternative: just grow node2 to fill the gap
      const newR2Alt: XYRect = {
        x: p2.rect.x,
        y: p2.rect.y - gap,
        width: p2.rect.width,
        height: p2.rect.height + gap,
      }
      if (!wouldCauseOverlap(newR2Alt, pair.idx2, p2.zLayers, state)) {
        updatePlacedRect(state, pair.idx2, newR2Alt)
        continue
      }

      // Try alternative: just grow node1 to fill the gap
      const newR1Alt: XYRect = {
        ...p1.rect,
        height: p1.rect.height + gap,
      }
      if (!wouldCauseOverlap(newR1Alt, pair.idx1, p1.zLayers, state)) {
        updatePlacedRect(state, pair.idx1, newR1Alt)
      }
    }
  }
}

/**
 * Helper to update a placed rect and maintain the placedByLayer index
 */
function updatePlacedRect(
  state: RectDiffState,
  index: number,
  newRect: XYRect,
): void {
  const p = state.placed[index]!
  const oldRect = p.rect

  // Update the placed array
  state.placed[index] = { rect: newRect, zLayers: p.zLayers }

  // Update placedByLayer index
  for (const z of p.zLayers) {
    const arr = state.placedByLayer[z]!
    const idx = arr.findIndex((r) => r === oldRect)
    if (idx >= 0) {
      arr[idx] = newRect
    }
  }
}
