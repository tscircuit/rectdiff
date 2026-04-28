/**
 * Check whether a z-layer span is contiguous.
 * Sparse promotion only creates shared nodes when the joined span has no gaps.
 */
export const hasContiguousZSpan = ({ zValues }: { zValues: number[] }) => {
  for (let i = 1; i < zValues.length; i++) {
    if (zValues[i]! - zValues[i - 1]! !== 1) return false
  }

  return true
}
