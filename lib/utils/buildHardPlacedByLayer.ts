import type { Placed3D, XYRect } from "../rectdiff-types"

export function buildHardPlacedByLayer(params: {
  layerCount: number
  placed: Placed3D[]
}): XYRect[][] {
  const out: XYRect[][] = Array.from({ length: params.layerCount }, () => [])
  for (const p of params.placed) {
    if (p.zLayers.length >= params.layerCount) {
      for (const z of p.zLayers) out[z]!.push(p.rect)
    }
  }
  return out
}
