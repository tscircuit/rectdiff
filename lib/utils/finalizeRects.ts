import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"

export function finalizeRects(params: {
  placed: Placed3D[]
  obstaclesByLayer: XYRect[][]
  boardVoidRects: XYRect[]
}): Rect3d[] {
  // Convert all placed (free space) nodes to output format
  const out: Rect3d[] = params.placed.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))

  /**
   * Recover obstacles as mesh nodes.
   * Obstacles are stored per-layer in `obstaclesByLayer`, but we want to emit
   * single 3D nodes for multi-layer obstacles if they share the same rect.
   * We use the `XYRect` object reference identity to group layers.
   */
  const layersByObstacleRect = new Map<XYRect, number[]>()

  params.obstaclesByLayer.forEach((layerObs, z) => {
    for (const rect of layerObs) {
      const layerIndices = layersByObstacleRect.get(rect) ?? []
      layerIndices.push(z)
      layersByObstacleRect.set(rect, layerIndices)
    }
  })

  // Append obstacle nodes to the output
  const voidSet = new Set(params.boardVoidRects || [])
  for (const [rect, layerIndices] of layersByObstacleRect.entries()) {
    if (voidSet.has(rect)) continue // Skip void rects

    out.push({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
      zLayers: layerIndices.sort((a, b) => a - b),
      isObstacle: true,
    })
  }

  return out
}
