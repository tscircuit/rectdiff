import type { Obstacle } from "lib/types/srj-types"
import type { Placed3D, Rect3d, XYRect } from "lib/rectdiff-types"
import { obstacleToXYRect, obstacleZs } from "../RectDiffSeedingSolver/layers"

export type ActiveRect = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  mask: number
}

export type ObstacleEntry = {
  rect: XYRect
  zLayers: number[]
}

export const maskToZLayers = (mask: number, layerCount: number) =>
  Array.from({ length: layerCount }, (_, z) => z).filter(
    (z) => (mask & (1 << z)) !== 0,
  )

export const activeRectToRect3d = (
  rect: ActiveRect,
  layerCount: number,
): Rect3d => ({
  minX: rect.minX,
  minY: rect.minY,
  maxX: rect.maxX,
  maxY: rect.maxY,
  zLayers: maskToZLayers(rect.mask, layerCount),
})

export function buildCoverageGrid(placed: Placed3D[]) {
  const maxLayer = placed.reduce(
    (currentMax, placement) =>
      Math.max(currentMax, ...placement.zLayers, currentMax),
    0,
  )
  const layerCount = maxLayer + 1

  const xs = Array.from(
    new Set(
      placed.flatMap((placement) => [
        placement.rect.x,
        placement.rect.x + placement.rect.width,
      ]),
    ),
  ).sort((a, b) => a - b)
  const ys = Array.from(
    new Set(
      placed.flatMap((placement) => [
        placement.rect.y,
        placement.rect.y + placement.rect.height,
      ]),
    ),
  ).sort((a, b) => a - b)

  const xIndex = new Map(xs.map((x, index) => [x, index]))
  const yIndex = new Map(ys.map((y, index) => [y, index]))
  const layerDiffs = Array.from({ length: layerCount }, () =>
    Array.from(
      { length: Math.max(1, ys.length + 1) },
      () => new Int32Array(Math.max(1, xs.length + 1)),
    ),
  )

  return {
    placed,
    layerCount,
    xs,
    ys,
    xIndex,
    yIndex,
    layerDiffs,
  }
}

export function buildMergedObstacles(params: {
  obstacles: Obstacle[]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): ObstacleEntry[] {
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
    zLayers.forEach((layer: number) => entry!.layers.add(layer))
  }

  return Array.from(layersByKey.values(), ({ rect, layers }) => ({
    rect,
    zLayers: Array.from(layers).sort((a, b) => a - b),
  }))
}
