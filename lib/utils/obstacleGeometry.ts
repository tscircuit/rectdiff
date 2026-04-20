import { computeDefaultGridSizes } from "../solvers/RectDiffSeedingSolver/computeDefaultGridSizes"
import type { GridFill3DOptions, XYRect } from "../rectdiff-types"
import type { Obstacle } from "../types/srj-types"
import { EPS } from "./rectdiff-geometry"

export type ObstaclePoint = { x: number; y: number }
export type ObstacleDisplayRect = {
  center: { x: number; y: number }
  width: number
  height: number
  ccwRotationDegrees?: number
}

export type RotatedObstacleApproximationOptions = {
  rotatedObstacleGridSize?: number
}

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > EPS

export const normalizeCcwRotationDegrees = (
  ccwRotationDegrees: number | undefined,
): number => {
  if (!Number.isFinite(ccwRotationDegrees)) return 0
  const normalized = ((ccwRotationDegrees % 360) + 360) % 360
  return Math.abs(normalized) <= EPS || Math.abs(normalized - 360) <= EPS
    ? 0
    : normalized
}

export const getObstacleRotationRadians = (obstacle: Obstacle): number =>
  (normalizeCcwRotationDegrees(obstacle.ccwRotationDegrees) * Math.PI) / 180

export const isObstacleRotated = (obstacle: Obstacle): boolean =>
  Math.abs(normalizeCcwRotationDegrees(obstacle.ccwRotationDegrees)) > EPS

export const getObstacleBodyRect = (obstacle: Obstacle): XYRect | null => {
  const { width, height, center } = obstacle
  if (
    !isFinitePositiveNumber(width) ||
    !isFinitePositiveNumber(height) ||
    !Number.isFinite(center?.x) ||
    !Number.isFinite(center?.y)
  ) {
    return null
  }

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  }
}

export const getObstacleDisplayRect = (
  obstacle: Obstacle,
): ObstacleDisplayRect | null => {
  const bodyRect = getObstacleBodyRect(obstacle)
  if (!bodyRect) return null

  const normalizedRotation = normalizeCcwRotationDegrees(
    obstacle.ccwRotationDegrees,
  )

  return {
    center: { x: obstacle.center.x, y: obstacle.center.y },
    width: bodyRect.width,
    height: bodyRect.height,
    ...(normalizedRotation > EPS
      ? { ccwRotationDegrees: normalizedRotation }
      : {}),
  }
}

export const getObstacleOutlinePoints = (
  obstacle: Obstacle,
): ObstaclePoint[] | null => {
  const bodyRect = getObstacleBodyRect(obstacle)
  if (!bodyRect) return null

  const theta = getObstacleRotationRadians(obstacle)
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const halfWidth = bodyRect.width / 2
  const halfHeight = bodyRect.height / 2
  const { x: cx, y: cy } = obstacle.center

  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ]

  return corners.map(({ x, y }) => ({
    x: cx + x * cosTheta - y * sinTheta,
    y: cy + x * sinTheta + y * cosTheta,
  }))
}

export const getObstacleBoundingBox = (obstacle: Obstacle): XYRect | null => {
  const outline = getObstacleOutlinePoints(obstacle)
  if (!outline?.length) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of outline) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export const isPointInsideObstacle = (
  obstacle: Obstacle,
  point: ObstaclePoint,
): boolean => {
  const bodyRect = getObstacleBodyRect(obstacle)
  if (!bodyRect) return false

  const theta = -getObstacleRotationRadians(obstacle)
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const dx = point.x - obstacle.center.x
  const dy = point.y - obstacle.center.y
  const localX = dx * cosTheta - dy * sinTheta
  const localY = dx * sinTheta + dy * cosTheta

  return (
    Math.abs(localX) <= bodyRect.width / 2 + EPS &&
    Math.abs(localY) <= bodyRect.height / 2 + EPS
  )
}

const buildGridLines = (min: number, max: number, step: number): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [min, max]
  if (!isFinitePositiveNumber(step) || max <= min + EPS) return [min, max]

  const coords = [min]
  let cursor = min + step
  while (cursor < max - EPS) {
    coords.push(cursor)
    cursor += step
  }
  if (coords[coords.length - 1]! < max - EPS) coords.push(max)
  return coords
}

const mergeTouchingRects = (rawRects: XYRect[]): XYRect[] => {
  if (rawRects.length <= 1) return rawRects

  const horizontalMerged: XYRect[] = []
  rawRects.sort((a, b) => {
    if (Math.abs(a.y - b.y) > EPS) return a.y - b.y
    return a.x - b.x
  })

  let current: XYRect | null = null
  for (const rect of rawRects) {
    if (!current) {
      current = { ...rect }
      continue
    }

    const sameY = Math.abs(current.y - rect.y) <= EPS
    const sameHeight = Math.abs(current.height - rect.height) <= EPS
    const touchesX = Math.abs(current.x + current.width - rect.x) <= EPS

    if (sameY && sameHeight && touchesX) {
      current.width += rect.width
    } else {
      horizontalMerged.push(current)
      current = { ...rect }
    }
  }
  if (current) horizontalMerged.push(current)

  const verticalMerged: XYRect[] = []
  horizontalMerged.sort((a, b) => {
    if (Math.abs(a.x - b.x) > EPS) return a.x - b.x
    return a.y - b.y
  })

  current = null
  for (const rect of horizontalMerged) {
    if (!current) {
      current = { ...rect }
      continue
    }

    const sameX = Math.abs(current.x - rect.x) <= EPS
    const sameWidth = Math.abs(current.width - rect.width) <= EPS
    const touchesY = Math.abs(current.y + current.height - rect.y) <= EPS

    if (sameX && sameWidth && touchesY) {
      current.height += rect.height
    } else {
      verticalMerged.push(current)
      current = { ...rect }
    }
  }
  if (current) verticalMerged.push(current)

  return verticalMerged
}

export const getApproximateObstacleRects = (
  obstacle: Obstacle,
  options: RotatedObstacleApproximationOptions = {},
): XYRect[] => {
  const bodyRect = getObstacleBodyRect(obstacle)
  if (!bodyRect) return []
  if (!isObstacleRotated(obstacle)) return [bodyRect]

  const bounds = getObstacleBoundingBox(obstacle)
  if (!bounds) return []

  const fallbackGridSize = Math.max(
    Math.min(bodyRect.width, bodyRect.height) / 4,
    EPS,
  )
  const gridSize =
    options.rotatedObstacleGridSize && options.rotatedObstacleGridSize > EPS
      ? options.rotatedObstacleGridSize
      : fallbackGridSize

  const xCoords = buildGridLines(bounds.x, bounds.x + bounds.width, gridSize)
  const yCoords = buildGridLines(bounds.y, bounds.y + bounds.height, gridSize)
  const rawRects: XYRect[] = []

  for (let xi = 0; xi < xCoords.length - 1; xi++) {
    for (let yi = 0; yi < yCoords.length - 1; yi++) {
      const x0 = xCoords[xi]!
      const x1 = xCoords[xi + 1]!
      const y0 = yCoords[yi]!
      const y1 = yCoords[yi + 1]!
      const cell: XYRect = {
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
      }

      if (cell.width <= EPS || cell.height <= EPS) continue

      const center = {
        x: cell.x + cell.width / 2,
        y: cell.y + cell.height / 2,
      }
      if (isPointInsideObstacle(obstacle, center)) rawRects.push(cell)
    }
  }

  return rawRects.length > 0 ? mergeTouchingRects(rawRects) : [bounds]
}

export const resolveRotatedObstacleGridSize = (params: {
  bounds: XYRect
  gridOptions?: Partial<GridFill3DOptions>
}): number | undefined => {
  if (isFinitePositiveNumber(params.gridOptions?.rotatedObstacleGridSize)) {
    return params.gridOptions.rotatedObstacleGridSize
  }

  const gridSizes =
    params.gridOptions?.gridSizes?.filter(isFinitePositiveNumber) ??
    computeDefaultGridSizes(params.bounds).filter(isFinitePositiveNumber)

  if (gridSizes.length === 0) return undefined
  return Math.min(...gridSizes)
}
