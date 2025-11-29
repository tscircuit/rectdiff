// lib/solvers/rectdiff/gapfill/engine/getGapFillProgress.ts
import type { GapFillState } from "../types"

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
