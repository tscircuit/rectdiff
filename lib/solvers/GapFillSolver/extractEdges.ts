import type { Placed3D, XYRect } from "../rectdiff/types"
import type { RectEdge } from "./types"

export function extractEdges(
  rects: Placed3D[],
  obstaclesByLayer: XYRect[][],
): RectEdge[] {
  const edges: RectEdge[] = []

  for (const placed of rects) {
    const { rect, zLayers } = placed

    edges.push({
      rect,
      side: "top",
      x1: rect.x,
      y1: rect.y + rect.height,
      x2: rect.x + rect.width,
      y2: rect.y + rect.height,
      normal: { x: 0, y: 1 },
      zLayers: [...zLayers],
    })

    edges.push({
      rect,
      side: "bottom",
      x1: rect.x,
      y1: rect.y,
      x2: rect.x + rect.width,
      y2: rect.y,
      normal: { x: 0, y: -1 },
      zLayers: [...zLayers],
    })

    edges.push({
      rect,
      side: "right",
      x1: rect.x + rect.width,
      y1: rect.y,
      x2: rect.x + rect.width,
      y2: rect.y + rect.height,
      normal: { x: 1, y: 0 },
      zLayers: [...zLayers],
    })

    edges.push({
      rect,
      side: "left",
      x1: rect.x,
      y1: rect.y,
      x2: rect.x,
      y2: rect.y + rect.height,
      normal: { x: -1, y: 0 },
      zLayers: [...zLayers],
    })
  }

  for (let z = 0; z < obstaclesByLayer.length; z++) {
    const obstacles = obstaclesByLayer[z] ?? []
    for (const rect of obstacles) {
      const zLayers = [z]

      edges.push({
        rect,
        side: "top",
        x1: rect.x,
        y1: rect.y + rect.height,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        normal: { x: 0, y: 1 },
        zLayers,
      })

      edges.push({
        rect,
        side: "bottom",
        x1: rect.x,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y,
        normal: { x: 0, y: -1 },
        zLayers,
      })

      edges.push({
        rect,
        side: "right",
        x1: rect.x + rect.width,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        normal: { x: 1, y: 0 },
        zLayers,
      })

      edges.push({
        rect,
        side: "left",
        x1: rect.x,
        y1: rect.y,
        x2: rect.x,
        y2: rect.y + rect.height,
        normal: { x: -1, y: 0 },
        zLayers,
      })
    }
  }

  return edges
}
