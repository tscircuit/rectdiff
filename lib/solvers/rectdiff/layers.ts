// lib/solvers/rectdiff/layers.ts
import type { SimpleRouteJson, Obstacle } from "../../types/srj-types"
import type { XYRect } from "./types"

function layerSortKey(n: string) {
  const L = n.toLowerCase()
  if (L === "top") return -1_000_000
  if (L === "bottom") return 1_000_000
  const m = /^inner(\d+)$/i.exec(L)
  if (m) return parseInt(m[1]!, 10) || 0
  return 100 + L.charCodeAt(0)
}

export function canonicalizeLayerOrder(names: string[]) {
  return Array.from(new Set(names)).sort((a, b) => {
    const ka = layerSortKey(a)
    const kb = layerSortKey(b)
    if (ka !== kb) return ka - kb
    return a.localeCompare(b)
  })
}

export function buildZIndexMap(srj: SimpleRouteJson) {
  const names = canonicalizeLayerOrder(
    (srj.obstacles ?? []).flatMap((o) => o.layers ?? []),
  )
  const declaredLayerCount = Math.max(1, srj.layerCount || names.length || 1)
  const fallback = Array.from({ length: declaredLayerCount }, (_, i) =>
    i === 0 ? "top" : i === declaredLayerCount - 1 ? "bottom" : `inner${i}`,
  )
  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (n: string) => {
    const key = n.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    ordered.push(n)
  }
  fallback.forEach(push)
  names.forEach(push)
  const layerNames = ordered.slice(0, declaredLayerCount)
  // Clamp any exotic layer names (extra inner layers, mixed casing, etc.)
  // onto the declared layerCount so every obstacle resolves to a legal z index.
  const clampIndex = (nameLower: string) => {
    if (layerNames.length <= 1) return 0
    if (nameLower === "top") return 0
    if (nameLower === "bottom") return layerNames.length - 1
    const m = /^inner(\d+)$/i.exec(nameLower)
    if (m) {
      if (layerNames.length <= 2) return layerNames.length - 1
      const parsed = parseInt(m[1]!, 10)
      const maxInner = layerNames.length - 2
      const clampedInner = Math.min(
        maxInner,
        Math.max(1, Number.isFinite(parsed) ? parsed : 1),
      )
      return clampedInner
    }
    return 0
  }
  const map = new Map<string, number>()
  layerNames.forEach((n, i) => map.set(n.toLowerCase(), i))
  ordered.slice(layerNames.length).forEach((n) => {
    const key = n.toLowerCase()
    map.set(key, clampIndex(key))
  })
  return { layerNames, zIndexByName: map }
}

export function obstacleZs(ob: Obstacle, zIndexByName: Map<string, number>) {
  if (ob.zLayers?.length)
    return Array.from(new Set(ob.zLayers)).sort((a, b) => a - b)
  const fromNames = (ob.layers ?? [])
    .map((n) => zIndexByName.get(n.toLowerCase()))
    .filter((v): v is number => typeof v === "number")
  return Array.from(new Set(fromNames)).sort((a, b) => a - b)
}

export function obstacleToXYRect(ob: Obstacle): XYRect | null {
  const w = ob.width as any
  const h = ob.height as any
  if (typeof w !== "number" || typeof h !== "number") return null
  return { x: ob.center.x - w / 2, y: ob.center.y - h / 2, width: w, height: h }
}
