import type { XYRect } from "lib/rectdiff-types"

const EPS = 1e-9

export const isSelfRect = (params: {
  rect: XYRect
  startX: number
  startY: number
  initialW: number
  initialH: number
}) =>
  Math.abs(params.rect.x + params.rect.width / 2 - params.startX) < EPS &&
  Math.abs(params.rect.y + params.rect.height / 2 - params.startY) < EPS &&
  Math.abs(params.rect.width - params.initialW) < EPS &&
  Math.abs(params.rect.height - params.initialH) < EPS
