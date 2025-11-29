// lib/solvers/rectdiff/gapfill/detection/rectsEqual.ts
import type { XYRect } from "../../types"
import { EPS } from "../../geometry"

export function rectsEqual(a: XYRect, b: XYRect): boolean {
  return (
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS
  )
}
