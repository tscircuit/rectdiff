// edge-expansion.config.ts
/**
 * Configuration constants for the EdgeExpansionSolver.
 * These are exposed at the top level for easy experimentation and tuning.
 */

export const EDGE_EXPANSION_CONFIG = {
  /**
   * Minimum space required for a node to continue expanding in a direction.
   * If available space < this threshold, the node stops expanding.
   *
   * Smaller values: More aggressive expansion, may create tiny slivers
   * Larger values: More conservative, may leave gaps
   *
   * Recommended range: 1-10 (in same units as your board dimensions)
   */
  MIN_REQUIRED_EXPAND_SPACE: 5,
}

