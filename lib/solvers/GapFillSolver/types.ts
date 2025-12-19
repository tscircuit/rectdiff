import type { XYRect } from "../rectdiff/types"

export interface RectEdge {
  rect: XYRect
  side: "top" | "bottom" | "left" | "right"
  x1: number
  y1: number
  x2: number
  y2: number
  normal: { x: number; y: number }
  zLayers: number[]
}
