export const getBoundsFromCorners = (
  corners: { x: number; y: number }[],
): { minX: number; minY: number; maxX: number; maxY: number } => {
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxX: Math.max(...corners.map((c) => c.x)),
    maxY: Math.max(...corners.map((c) => c.y)),
  }
}
