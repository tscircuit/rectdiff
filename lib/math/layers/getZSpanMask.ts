/**
 * Encode a z-span as a numeric bitmask for grouping and comparisons.
 * This avoids string keys when the span is really a set of layer flags.
 */
export const getZSpanMask = ({ availableZ }: { availableZ: number[] }) =>
  availableZ.reduce((mask, z) => mask | (1 << z), 0)
