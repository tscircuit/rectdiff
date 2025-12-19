import type { Placed3D } from "../rectdiff/types"
import type { RectEdge } from "./types"

export function expandEdgeToRect(
  primaryEdge: RectEdge,
  nearbyEdge: RectEdge,
): Placed3D | null {
  let rect: { x: number; y: number; width: number; height: number }

  if (Math.abs(primaryEdge.normal.x) > 0.5) {
    const leftX = primaryEdge.normal.x > 0 ? primaryEdge.x1 : nearbyEdge.x1
    const rightX = primaryEdge.normal.x > 0 ? nearbyEdge.x1 : primaryEdge.x1

    rect = {
      x: leftX,
      y: primaryEdge.y1,
      width: rightX - leftX,
      height: primaryEdge.y2 - primaryEdge.y1,
    }
  } else {
    const bottomY = primaryEdge.normal.y > 0 ? primaryEdge.y1 : nearbyEdge.y1
    const topY = primaryEdge.normal.y > 0 ? nearbyEdge.y1 : primaryEdge.y1

    rect = {
      x: primaryEdge.x1,
      y: bottomY,
      width: primaryEdge.x2 - primaryEdge.x1,
      height: topY - bottomY,
    }
  }

  return {
    rect,
    zLayers: [...primaryEdge.zLayers],
  }
}
