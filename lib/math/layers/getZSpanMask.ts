/**
 * Turn a layer list into a numeric mask.
 * This is used for fast grouping and comparisons.
 */
export const getZSpanMask = ({ availableZ }: { availableZ: number[] }) =>
  availableZ.reduce((mask, z) => mask | (1 << z), 0)
