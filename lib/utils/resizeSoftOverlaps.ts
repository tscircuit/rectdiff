import type { Placed3D, XYRect } from "../rectdiff-types"
import { overlaps, subtractRect2D, EPS } from "./rectdiff-geometry"

export function resizeSoftOverlaps(
  params: {
    layerCount: number
    placed: Placed3D[]
    placedByLayer: XYRect[][]
    options: any
  },
  newIndex: number,
) {
  const newcomer = params.placed[newIndex]!
  const { rect: newR, zLayers: newZs } = newcomer
  const layerCount = params.layerCount

  const removeIdx: number[] = []
  const toAdd: typeof params.placed = []

  for (let i = 0; i < params.placed.length; i++) {
    if (i === newIndex) continue
    const old = params.placed[i]!
    // Protect full-stack nodes
    if (old.zLayers.length >= layerCount) continue

    const sharedZ = old.zLayers.filter((z) => newZs.includes(z))
    if (sharedZ.length === 0) continue
    if (!overlaps(old.rect, newR)) continue

    // Carve the overlap on the shared layers
    const parts = subtractRect2D(old.rect, newR)

    // We will replace `old` entirely; re-add unaffected layers (same rect object).
    removeIdx.push(i)

    const unaffectedZ = old.zLayers.filter((z) => !newZs.includes(z))
    if (unaffectedZ.length > 0) {
      toAdd.push({ rect: old.rect, zLayers: unaffectedZ })
    }

    // Re-add carved pieces for affected layers, dropping tiny slivers
    const minW = Math.min(
      params.options.minSingle.width,
      params.options.minMulti.width,
    )
    const minH = Math.min(
      params.options.minSingle.height,
      params.options.minMulti.height,
    )
    for (const p of parts) {
      if (p.width + EPS >= minW && p.height + EPS >= minH) {
        toAdd.push({ rect: p, zLayers: sharedZ.slice() })
      }
    }
  }

  // Remove (and clear placedByLayer)
  removeIdx
    .sort((a, b) => b - a)
    .forEach((idx) => {
      const rem = params.placed.splice(idx, 1)[0]!
      for (const z of rem.zLayers) {
        const arr = params.placedByLayer[z]!
        const j = arr.findIndex((r) => r === rem.rect)
        if (j >= 0) arr.splice(j, 1)
      }
    })

  // Add replacements
  for (const p of toAdd) {
    params.placed.push(p)
    for (const z of p.zLayers) params.placedByLayer[z]!.push(p.rect)
  }
}
