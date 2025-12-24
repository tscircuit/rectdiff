import type { XYRect } from "lib/rectdiff-types"
import type { RTreeRect } from "lib/types/capacity-mesh-types"

export const rectToTree = (rect: XYRect): RTreeRect => ({
  ...rect,
  minX: rect.x,
  minY: rect.y,
  maxX: rect.x + rect.width,
  maxY: rect.y + rect.height,
})
