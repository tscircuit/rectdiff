import type { EdgeExpansionState } from "./types"

/**
 * Compute progress (0 to 1)
 */
export function computeProgress(state: EdgeExpansionState): number {
  if (state.phase === "DONE") return 1
  const totalNodes = state.nodes.length
  const doneNodes = state.nodes.filter((n) => n.done).length
  return totalNodes > 0 ? doneNodes / totalNodes : 0
}

