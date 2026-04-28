/**
 * Check whether the layers form one continuous range.
 * Gapped layer spans return false.
 */
export const hasContiguousZSpan = ({ zValues }: { zValues: number[] }) => {
  for (let i = 1; i < zValues.length; i++) {
    if (zValues[i]! - zValues[i - 1]! !== 1) return false
  }

  return true
}
