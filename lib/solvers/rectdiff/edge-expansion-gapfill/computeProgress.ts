// lib/solvers/rectdiff/edge-expansion-gapfill/computeProgress.ts
import type { EdgeExpansionGapFillState } from "./types"

export function computeProgress(state: EdgeExpansionGapFillState): number {
  if (state.phase === "DONE") {
    return 1
  }

  const totalObstacles = state.edgeExpansionObstacles.length
  if (totalObstacles === 0) {
    return 1
  }

  return state.currentObstacleIndex / totalObstacles
}
