/**
 * Build the display name for a layer span.
 * This keeps layer labels consistent.
 */
export const getZLayerName = ({ availableZ }: { availableZ: number[] }) =>
  `z${availableZ.join(",")}`
