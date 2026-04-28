/**
 * Format a z-span as the layer label used by mesh nodes and debug graphics.
 * This keeps layer-name string building in one place instead of inlined templates.
 */
export const getZLayerName = ({ availableZ }: { availableZ: number[] }) =>
  `z${availableZ.join(",")}`
