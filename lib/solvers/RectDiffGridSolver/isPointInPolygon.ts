/**
 * Check if a point is inside a polygon using ray casting.
 */
export function isPointInPolygon(
  p: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x,
      yi = polygon[i]!.y
    const xj = polygon[j]!.x,
      yj = polygon[j]!.y

    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}
