import { EPS } from "./rectdiff-geometry"

/** Dedupe sorted edge values with EPS tolerance. */
export function dedupeSortedEdges(edges: number[]): number[] {
  const sorted = edges.slice().sort((a, b) => a - b)
  const out: number[] = []

  for (const edge of sorted) {
    const last = out[out.length - 1]
    if (last === undefined || Math.abs(edge - last) > EPS) {
      out.push(edge)
    }
  }

  return out
}
