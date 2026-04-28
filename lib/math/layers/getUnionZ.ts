/**
 * Return a sorted unique union of two z-layer spans.
 * This keeps promotion logic focused on span shape instead of array cleanup.
 */
export const getUnionZ = ({ a, b }: { a: number[]; b: number[] }) =>
  [...new Set([...a, ...b])].sort((x, y) => x - y)
