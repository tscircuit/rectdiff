import { boundsIntersection } from "@tscircuit/math-utils"
import type { Obstacle, SimpleRouteJson } from "../../types/srj-types"
import type { Rect3d, XYRect } from "../../rectdiff-types"
import { obstacleToXYRect, obstacleZs } from "../RectDiffSeedingSolver/layers"
import { EPS, overlaps, subtractRect2D } from "../../utils/rectdiff-geometry"
import { padRect } from "../../utils/padRect"
import { mergeAdjacentFreeRects } from "./mergeAdjacentFreeRects"

type PreparedObstacle = { obstacle: Obstacle; rect: XYRect; layers: number[] }

const rectToXYRect = (rect: Rect3d): XYRect => ({
  x: rect.minX,
  y: rect.minY,
  width: rect.maxX - rect.minX,
  height: rect.maxY - rect.minY,
})

const rectBounds = (rect: XYRect) => ({
  minX: rect.x,
  minY: rect.y,
  maxX: rect.x + rect.width,
  maxY: rect.y + rect.height,
})

function createRefinedRect({
  source,
  rect,
}: {
  source: Rect3d
  rect: XYRect
}): Rect3d {
  return { ...source, ...rectBounds(rect) }
}

function isCopperPourTransit(
  {
    rect,
    zLayers,
    skippedLayers,
  }: {
    rect: XYRect
    zLayers: number[]
    skippedLayers: number[]
  },
  obstacles: PreparedObstacle[],
): boolean {
  const crossingObstacles = obstacles.filter(
    (entry) =>
      entry.layers.some((z) => z >= zLayers[0]! && z <= zLayers.at(-1)!) &&
      overlaps(entry.rect, rect),
  )
  if (crossingObstacles.some((entry) => !entry.obstacle.isCopperPour))
    return false
  return skippedLayers.every((z) => {
    let uncovered = [rect]
    for (const entry of crossingObstacles) {
      if (!entry.layers.includes(z)) continue
      uncovered = uncovered.flatMap((piece) =>
        subtractRect2D(piece, entry.rect),
      )
    }
    return uncovered.length === 0
  })
}

/** Refine free rectangles across copper-pour layers while retaining each remainder. */
export function refineFreeLayerOverlaps({
  rects,
  simpleRouteJson,
  zIndexByName,
  obstacleClearance = 0,
  transitClearance = 0,
}: {
  rects: Rect3d[]
  simpleRouteJson: Pick<
    SimpleRouteJson,
    "obstacles" | "minTraceWidth" | "minViaDiameter"
  >
  zIndexByName: Map<string, number>
  obstacleClearance?: number
  transitClearance?: number
}): Rect3d[] {
  const freeRects = rects.filter((region) => !region.isObstacle)
  const singleLayerRects = freeRects.filter(
    (region) => region.zLayers.length === 1,
  )
  const multilayerRects = freeRects.filter(
    (region) => region.zLayers.length > 1,
  )
  if (singleLayerRects.length === 0 || multilayerRects.length === 0) {
    return rects
  }
  const obstacles = simpleRouteJson.obstacles.flatMap((obstacle) => {
    const rect = obstacleToXYRect(obstacle)
    if (!rect) return []
    return [
      {
        obstacle,
        rect: padRect(rect, obstacleClearance),
        layers: obstacleZs(obstacle, zIndexByName),
      },
    ]
  })
  const pieces = new Map(
    rects.map((region) => {
      const original = rectToXYRect(region)
      return [region, { original, remaining: [original] }]
    }),
  )
  const sharedRects: Rect3d[] = []
  const minViaSize = Math.max(
    simpleRouteJson.minViaDiameter ?? 0,
    simpleRouteJson.minTraceWidth,
  ) + 2 * transitClearance

  for (const single of singleLayerRects) {
    for (const multi of multilayerRects) {
      if (multi.zLayers.includes(single.zLayers[0]!)) continue
      const zLayers = [...single.zLayers, ...multi.zLayers].sort(
        (a, b) => a - b,
      )
      const skippedLayers: number[] = []
      for (let z = zLayers[0]!; z <= zLayers.at(-1)!; z++) {
        if (!zLayers.includes(z)) skippedLayers.push(z)
      }
      if (skippedLayers.length === 0) continue
      const singlePieces = pieces.get(single)!.remaining
      const multiPieces = pieces.get(multi)!.remaining
      let singlePieceIndex = 0
      while (singlePieceIndex < singlePieces.length) {
        const singleRect = singlePieces[singlePieceIndex]!
        let merged = false
        for (
          let multiPieceIndex = 0;
          multiPieceIndex < multiPieces.length;
          multiPieceIndex++
        ) {
          const multiRect = multiPieces[multiPieceIndex]!
          const overlap = boundsIntersection(
            rectBounds(singleRect),
            rectBounds(multiRect),
          )
          if (!overlap) continue
          const rect = {
            x: overlap.minX,
            y: overlap.minY,
            width: overlap.maxX - overlap.minX,
            height: overlap.maxY - overlap.minY,
          }
          if (rect.width + EPS < minViaSize || rect.height + EPS < minViaSize)
            continue
          if (!isCopperPourTransit({ rect, zLayers, skippedLayers }, obstacles))
            continue
          sharedRects.push({
            ...createRefinedRect({ source: single, rect }),
            zLayers,
          })
          singlePieces.splice(
            singlePieceIndex,
            1,
            ...subtractRect2D(singleRect, rect),
          )
          multiPieces.splice(
            multiPieceIndex,
            1,
            ...subtractRect2D(multiRect, rect),
          )
          merged = true
          break
        }
        // A split replaces this piece; inspect its remainders before advancing.
        if (!merged) singlePieceIndex++
      }
    }
  }
  if (sharedRects.length === 0) return rects
  const refinedRects = rects
    .flatMap((region) => {
      const { original, remaining } = pieces.get(region)!
      if (remaining.length === 1 && remaining[0] === original) return [region]
      return remaining.map((rect) =>
        createRefinedRect({ source: region, rect }),
      )
    })
    .concat(sharedRects)
  return mergeAdjacentFreeRects(refinedRects)
}
