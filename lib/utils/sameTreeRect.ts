import type { RTreeRect } from "lib/types/capacity-mesh-types"

export const sameTreeRect = (a: RTreeRect, b: RTreeRect) =>
  a.minX === b.minX &&
  a.minY === b.minY &&
  a.maxX === b.maxX &&
  a.maxY === b.maxY
