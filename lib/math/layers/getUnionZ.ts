/**
 * Combine two layer lists into one ordered list.
 * Duplicate layers are removed.
 */
export const getUnionZ = ({ a, b }: { a: number[]; b: number[] }) =>
  [...new Set([...a, ...b])].sort((x, y) => x - y)
