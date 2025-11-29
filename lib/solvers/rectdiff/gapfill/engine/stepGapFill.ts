// lib/solvers/rectdiff/gapfill/engine/stepGapFill.ts
import type { GapFillState } from "../types"
import { findAllGaps } from "../detection"
import { tryExpandGap } from "./tryExpandGap"
import { addPlacement } from "./addPlacement"

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
