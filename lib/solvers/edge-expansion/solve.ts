import type { EdgeExpansionState } from "./types"
import { stepExpansion } from "./stepExpansion"

/**
 * Run the algorithm to completion
 */
export function solve(state: EdgeExpansionState, maxIterations = 100): void {
  let iterations = 0
  while (state.phase !== "DONE" && iterations < maxIterations) {
    const didWork = stepExpansion(state)
    if (!didWork) break
    iterations++
  }
  state.phase = "DONE"
}

