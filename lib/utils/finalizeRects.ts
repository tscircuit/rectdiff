import type { Obstacle } from "lib/types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "../rectdiff-types"
import {
  obstacleToXYRect,
  obstacleZs,
} from "../solvers/RectDiffSeedingSolver/layers"
import { canonicalizeLayeredRects } from "./canonicalizeLayeredRects"
import { intersect1D, subtractRect2D, EPS } from "./rectdiff-geometry"

export function finalizeRects(params: {
  placed: Placed3D[]
  obstacles: Obstacle[]
  boardVoidRects: XYRect[]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): Rect3d[] {
  const promotedRects = canonicalizeLayeredRects(params.placed).filter(
    (rect) => rect.zLayers.length > 1,
  )

  let freePlacements: Placed3D[] = params.placed.map((placement) => ({
    rect: { ...placement.rect },
    zLayers: placement.zLayers.slice().sort((a, b) => a - b),
  }))

  for (const promoted of promotedRects) {
    const promotedRect: XYRect = {
      x: promoted.minX,
      y: promoted.minY,
      width: promoted.maxX - promoted.minX,
      height: promoted.maxY - promoted.minY,
    }

    const nextPlacements: Placed3D[] = []

    for (const placement of freePlacements) {
      const sharedZ = placement.zLayers.filter((z) =>
        promoted.zLayers.includes(z),
      )
      if (sharedZ.length === 0) {
        nextPlacements.push(placement)
        continue
      }

      const Xi = intersect1D(
        [placement.rect.x, placement.rect.x + placement.rect.width],
        [promotedRect.x, promotedRect.x + promotedRect.width],
      )
      const Yi = intersect1D(
        [placement.rect.y, placement.rect.y + placement.rect.height],
        [promotedRect.y, promotedRect.y + promotedRect.height],
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
      if (!overlapCore) {
        nextPlacements.push(placement)
        continue
      }

      const outsideParts = subtractRect2D(placement.rect, promotedRect)
      for (const part of outsideParts) {
        if (part.width > EPS && part.height > EPS) {
          nextPlacements.push({
            rect: part,
            zLayers: placement.zLayers.slice(),
          })
        }
      }

      const unaffectedZ = placement.zLayers.filter(
        (z) => !promoted.zLayers.includes(z),
      )
      if (
        unaffectedZ.length > 0 &&
        overlapCore.width > EPS &&
        overlapCore.height > EPS
      ) {
        nextPlacements.push({
          rect: overlapCore,
          zLayers: unaffectedZ,
        })
      }
    }

    nextPlacements.push({
      rect: promotedRect,
      zLayers: promoted.zLayers.slice(),
    })

    const deduped = new Map<string, Placed3D>()
    for (const placement of nextPlacements) {
      if (placement.rect.width <= EPS || placement.rect.height <= EPS) continue
      placement.zLayers = Array.from(new Set(placement.zLayers)).sort(
        (a, b) => a - b,
      )
      if (placement.zLayers.length === 0) continue

      const key = [
        placement.rect.x.toFixed(9),
        placement.rect.y.toFixed(9),
        placement.rect.width.toFixed(9),
        placement.rect.height.toFixed(9),
      ].join(":")
      const existing = deduped.get(key)
      if (!existing) {
        deduped.set(key, placement)
        continue
      }
      for (const z of placement.zLayers) {
        if (!existing.zLayers.includes(z)) existing.zLayers.push(z)
      }
      existing.zLayers.sort((a, b) => a - b)
    }

    freePlacements = Array.from(deduped.values())
  }

  const out: Rect3d[] = freePlacements.map((p) => ({
    minX: p.rect.x,
    minY: p.rect.y,
    maxX: p.rect.x + p.rect.width,
    maxY: p.rect.y + p.rect.height,
    zLayers: [...p.zLayers].sort((a, b) => a - b),
  }))

  const layersByKey = new Map<string, { rect: XYRect; layers: Set<number> }>()

  for (const obstacle of params.obstacles ?? []) {
    const baseRect = obstacleToXYRect(obstacle)
    if (!baseRect) continue
    const rect = params.obstacleClearance
      ? {
          x: baseRect.x - params.obstacleClearance,
          y: baseRect.y - params.obstacleClearance,
          width: baseRect.width + 2 * params.obstacleClearance,
          height: baseRect.height + 2 * params.obstacleClearance,
        }
      : baseRect
    const zLayers =
      obstacle.zLayers?.length && obstacle.zLayers.length > 0
        ? obstacle.zLayers
        : obstacleZs(obstacle, params.zIndexByName)
    const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`
    let entry = layersByKey.get(key)
    if (!entry) {
      entry = { rect, layers: new Set() }
      layersByKey.set(key, entry)
    }
    zLayers.forEach((layer: number) => {
      entry!.layers.add(layer)
    })
  }

  for (const { rect, layers } of layersByKey.values()) {
    out.push({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
      zLayers: Array.from(layers).sort((a, b) => a - b),
      isObstacle: true,
    })
  }

  return out
}
