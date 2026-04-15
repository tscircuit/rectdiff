import type { RTreeRect } from "lib/types/capacity-mesh-types"
import type { Placed3D } from "../rectdiff-types"
import { overlaps, subtractRect2D, intersect1D, EPS } from "./rectdiff-geometry"
import type RBush from "rbush"
import { rectToTree } from "./rectToTree"

export function resizeSoftOverlaps(
  params: {
    layerCount: number
    placed: Placed3D[]
    options: any
    placedIndexByLayer?: Array<RBush<RTreeRect> | undefined>
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

    // Carve only the shared layers. Non-overlapped pieces keep the full
    // original layer set, and the overlapped core keeps only unaffected layers.
    const parts = subtractRect2D(old.rect, newR)
    const Xi = intersect1D(
      [old.rect.x, old.rect.x + old.rect.width],
      [newR.x, newR.x + newR.width],
    )
    const Yi = intersect1D(
      [old.rect.y, old.rect.y + old.rect.height],
      [newR.y, newR.y + newR.height],
    )
    let overlapCore: {
      x: number
      y: number
      width: number
      height: number
    } | null = null
    if (Xi && Yi && Xi[1] - Xi[0] > EPS && Yi[1] - Yi[0] > EPS) {
      overlapCore = {
        x: Xi[0],
        y: Yi[0],
        width: Xi[1] - Xi[0],
        height: Yi[1] - Yi[0],
      }
    }
    const unaffectedZ = old.zLayers.filter((z) => !newZs.includes(z))

    // We will replace `old` entirely and rebuild it from parts.
    removeIdx.push(i)

    // Outside the overlap, the old node still exists on all of its layers.
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
        toAdd.push({ rect: p, zLayers: old.zLayers.slice() })
      }
    }

    // Inside the overlap, only the old node's non-shared layers remain.
    if (
      overlapCore &&
      unaffectedZ.length > 0 &&
      overlapCore.width + EPS >= minW &&
      overlapCore.height + EPS >= minH
    ) {
      toAdd.push({ rect: overlapCore, zLayers: unaffectedZ })
    }
  }

  // Remove fully overlapped nodes and keep indexes in sync
  const sameRect = (a: RTreeRect, b: RTreeRect) =>
    a.minX === b.minX &&
    a.minY === b.minY &&
    a.maxX === b.maxX &&
    a.maxY === b.maxY

  removeIdx
    .sort((a, b) => b - a)
    .forEach((idx) => {
      const rem = params.placed.splice(idx, 1)[0]!
      if (params.placedIndexByLayer) {
        for (const z of rem.zLayers) {
          const tree = params.placedIndexByLayer[z]
          if (tree)
            tree.remove(
              rectToTree(rem.rect, { zLayers: rem.zLayers }),
              sameRect,
            )
        }
      }
    })

  // Add replacements
  for (const p of toAdd) {
    params.placed.push(p)
    for (const z of p.zLayers) {
      if (params.placedIndexByLayer) {
        const idx = params.placedIndexByLayer[z]
        if (idx) {
          idx.insert(rectToTree(p.rect, { zLayers: p.zLayers.slice() }))
        }
      }
    }
  }
}
