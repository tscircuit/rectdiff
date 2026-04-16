import type { XYRect } from "lib/rectdiff-types"

export const searchStripRight = ({
  rect,
  bounds,
}: {
  rect: XYRect
  bounds: XYRect
}): XYRect => ({
  x: rect.x,
  y: rect.y,
  width: bounds.x + bounds.width - rect.x,
  height: rect.height,
})
export const searchStripDown = ({
  rect,
  bounds,
}: {
  rect: XYRect
  bounds: XYRect
}): XYRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: bounds.y + bounds.height - rect.y,
})
export const searchStripLeft = ({
  rect,
  bounds,
}: {
  rect: XYRect
  bounds: XYRect
}): XYRect => ({
  x: bounds.x,
  y: rect.y,
  width: rect.x - bounds.x,
  height: rect.height,
})
export const searchStripUp = ({
  rect,
  bounds,
}: {
  rect: XYRect
  bounds: XYRect
}): XYRect => ({
  x: rect.x,
  y: bounds.y,
  width: rect.width,
  height: rect.y - bounds.y,
})
