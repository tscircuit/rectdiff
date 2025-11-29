// lib/solvers/rectdiff/gapfill/detection/rectsOverlap.ts
import type { XYRect } from "../../types"
import { EPS } from "../../geometry"

export function rectsOverlap(a: XYRect, b: XYRect): boolean {
  return !(
    a.x + a.width <= b.x + EPS ||
    b.x + b.width <= a.x + EPS ||
    a.y + a.height <= b.y + EPS ||
    b.y + b.height <= a.y + EPS
  )
}
