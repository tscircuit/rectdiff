import type { Placed3D, Rect3d } from "../rectdiff-types"
import { EPS, containsPoint } from "./rectdiff-geometry"

type RectRun = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  zLayers: number[]
}

const sortNumbers = (a: number, b: number) => a - b

function dedupeSortedEdges(edges: number[]): number[] {
  const sorted = edges.slice().sort(sortNumbers)
  const out: number[] = []

  for (const edge of sorted) {
    const last = out[out.length - 1]
    if (last === undefined || Math.abs(edge - last) > EPS) {
      out.push(edge)
    }
  }

  return out
}

function splitIntoContiguousLayerRuns(zLayers: number[]): number[][] {
  if (zLayers.length === 0) return []

  const sorted = Array.from(new Set(zLayers)).sort(sortNumbers)
  const out: number[][] = []
  let current = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const z = sorted[i]!
    const prev = current[current.length - 1]!

    if (z === prev + 1) {
      current.push(z)
      continue
    }

    out.push(current)
    current = [z]
  }

  out.push(current)
  return out
}

function getCellLayerRuns(params: {
  minX: number
  maxX: number
  minY: number
  maxY: number
  placed: Placed3D[]
}): number[][] {
  const { minX, maxX, minY, maxY, placed } = params
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const zLayers = new Set<number>()

  for (const placement of placed) {
    if (!containsPoint(placement.rect, { x: midX, y: midY })) continue

    for (const z of placement.zLayers) {
      zLayers.add(z)
    }
  }

  return splitIntoContiguousLayerRuns(Array.from(zLayers))
}

function buildRowRuns(placed: Placed3D[]): RectRun[] {
  const xEdges = dedupeSortedEdges(
    placed.flatMap((placement) => [
      placement.rect.x,
      placement.rect.x + placement.rect.width,
    ]),
  )
  const yEdges = dedupeSortedEdges(
    placed.flatMap((placement) => [
      placement.rect.y,
      placement.rect.y + placement.rect.height,
    ]),
  )

  const runs: RectRun[] = []

  for (let yi = 0; yi < yEdges.length - 1; yi++) {
    const minY = yEdges[yi]!
    const maxY = yEdges[yi + 1]!
    if (maxY - minY <= EPS) continue

    const openRuns = new Map<string, RectRun>()

    for (let xi = 0; xi < xEdges.length - 1; xi++) {
      const minX = xEdges[xi]!
      const maxX = xEdges[xi + 1]!
      if (maxX - minX <= EPS) continue

      const layerRuns = getCellLayerRuns({
        minX,
        maxX,
        minY,
        maxY,
        placed,
      })

      const seenKeys = new Set<string>()

      for (const zLayers of layerRuns) {
        const key = zLayers.join(",")
        seenKeys.add(key)
        const existing = openRuns.get(key)

        if (existing && Math.abs(existing.maxX - minX) <= EPS) {
          existing.maxX = maxX
          continue
        }

        if (existing) runs.push(existing)

        openRuns.set(key, {
          minX,
          maxX,
          minY,
          maxY,
          zLayers,
        })
      }

      for (const [key, run] of openRuns) {
        if (seenKeys.has(key)) continue
        runs.push(run)
        openRuns.delete(key)
      }
    }

    for (const run of openRuns.values()) {
      runs.push(run)
    }
  }

  return runs
}

function mergeRunsVertically(runs: RectRun[]): Rect3d[] {
  const sorted = runs.slice().sort((a, b) => {
    if (Math.abs(a.minY - b.minY) > EPS) return a.minY - b.minY
    if (Math.abs(a.maxY - b.maxY) > EPS) return a.maxY - b.maxY
    if (Math.abs(a.minX - b.minX) > EPS) return a.minX - b.minX
    if (Math.abs(a.maxX - b.maxX) > EPS) return a.maxX - b.maxX
    return a.zLayers.join(",").localeCompare(b.zLayers.join(","))
  })

  const out: Rect3d[] = []
  const active = new Map<string, Rect3d>()

  for (const run of sorted) {
    const key = [
      run.minX.toFixed(9),
      run.maxX.toFixed(9),
      run.zLayers.join(","),
    ].join(":")
    const existing = active.get(key)

    if (existing && Math.abs(existing.maxY - run.minY) <= EPS) {
      existing.maxY = run.maxY
      continue
    }

    if (existing) out.push(existing)

    active.set(key, {
      minX: run.minX,
      minY: run.minY,
      maxX: run.maxX,
      maxY: run.maxY,
      zLayers: run.zLayers.slice(),
    })
  }

  for (const rect of active.values()) {
    out.push(rect)
  }

  return out
    .filter((rect) => rect.maxX - rect.minX > EPS && rect.maxY - rect.minY > EPS)
    .sort((a, b) => {
      const aKey = a.zLayers.join(",")
      const bKey = b.zLayers.join(",")
      if (aKey !== bKey) return aKey.localeCompare(bKey)
      if (Math.abs(a.minY - b.minY) > EPS) return a.minY - b.minY
      if (Math.abs(a.minX - b.minX) > EPS) return a.minX - b.minX
      if (Math.abs(a.maxY - b.maxY) > EPS) return a.maxY - b.maxY
      return a.maxX - b.maxX
    })
}

export function canonicalizeLayeredRects(placed: Placed3D[]): Rect3d[] {
  if (placed.length === 0) return []
  return mergeRunsVertically(buildRowRuns(placed))
}
