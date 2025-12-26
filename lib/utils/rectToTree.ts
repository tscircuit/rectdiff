import type { XYRect } from "lib/rectdiff-types"
import type { RTreeRect } from "lib/types/capacity-mesh-types"

export const rectToTree = (
  rect: XYRect,
  opts: { zLayers: number[] },
): RTreeRect => ({
  ...rect,
  minX: rect.x,
  minY: rect.y,
  maxX: rect.x + rect.width,
  maxY: rect.y + rect.height,
  zLayers: opts.zLayers,
})
