import type { Candidate3D, XYRect } from "../../rectdiff-types"
import type { SimpleRouteJson } from "../../types/srj-types"
import { EPS, distancePointToRectEdges } from "../../utils/rectdiff-geometry"
import { isFullyOccupiedAtPoint } from "../../utils/isFullyOccupiedAtPoint"
import { padRect } from "../../utils/padRect"
import { obstacleToXYRect, obstacleZs } from "./layers"
import { longestFreeSpanAroundZ } from "./longestFreeSpanAroundZ"
import type RBush from "rbush"
import type { RTreeRect } from "../../types/capacity-mesh-types"

const quantize = (value: number, precision = 1e-6) =>
  Math.round(value / precision) * precision

type ConcretePoint = NonNullable<
  SimpleRouteJson["connections"]
>[number]["pointsToConnect"][number] & {
  x: number
  y: number
  layer: string
}

const isConcretePoint = (point: unknown): point is ConcretePoint =>
  !!point &&
  typeof point === "object" &&
  typeof (point as any).x === "number" &&
  typeof (point as any).y === "number" &&
  typeof (point as any).layer === "string"

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Create precise seeds around explicit connection points so later routing can
 * preserve finer-grained escape regions around ports and pads.
 */
export function computeConnectionCandidates3D(params: {
  bounds: XYRect
  simpleRouteJson: SimpleRouteJson
  minSize: number
  layerCount: number
  obstacleIndexByLayer: Array<RBush<RTreeRect> | undefined>
  placedIndexByLayer: Array<RBush<RTreeRect> | undefined>
  hardPlacedByLayer: XYRect[][]
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): Candidate3D[] {
  const {
    bounds,
    simpleRouteJson,
    minSize,
    layerCount,
    obstacleIndexByLayer,
    placedIndexByLayer,
    hardPlacedByLayer,
    zIndexByName,
    obstacleClearance,
  } = params

  const out: Candidate3D[] = []
  const dedup = new Set<string>()
  const delta = Math.max(minSize * 0.15, EPS * 3)
  const hardRectsByLayer = Array.from({ length: layerCount }, (_, z) => [
    ...(obstacleIndexByLayer[z]?.all() ?? []),
    ...(hardPlacedByLayer[z] ?? []),
  ])

  const key = (p: { x: number; y: number; z: number }) =>
    `${p.z}|${p.x.toFixed(6)}|${p.y.toFixed(6)}`

  const fullyOcc = (p: { x: number; y: number }) =>
    isFullyOccupiedAtPoint({
      layerCount,
      obstacleIndexByLayer,
      placedIndexByLayer,
      point: p,
    })

  const pushIfFree = (p: { x: number; y: number; z: number }) => {
    const x = quantize(p.x)
    const y = quantize(p.y)
    const { z } = p

    if (
      x < bounds.x + EPS ||
      y < bounds.y + EPS ||
      x > bounds.x + bounds.width - EPS ||
      y > bounds.y + bounds.height - EPS
    ) {
      return
    }

    if (fullyOcc({ x, y })) return

    let d = distancePointToRectEdges({ x, y }, bounds)
    for (const blocker of hardRectsByLayer[z] ?? []) {
      d = Math.min(d, distancePointToRectEdges({ x, y }, blocker))
    }
    const distance = quantize(d)

    const dedupKey = key({ x, y, z })
    if (dedup.has(dedupKey)) return
    dedup.add(dedupKey)

    const span = longestFreeSpanAroundZ({
      x,
      y,
      z,
      layerCount,
      minSpan: 1,
      maxSpan: undefined,
      obstacleIndexByLayer,
      additionalBlockersByLayer: hardPlacedByLayer,
    })

    out.push({
      x,
      y,
      z,
      distance,
      zSpanLen: span.length,
      isEdgeSeed: true,
    })
  }

  const concretePoints = (simpleRouteJson.connections ?? [])
    .flatMap((connection) => connection.pointsToConnect ?? [])
    .filter(isConcretePoint)

  const obstacleRectsByLayer = Array.from({ length: layerCount }, () => [])
  for (const obstacle of simpleRouteJson.obstacles ?? []) {
    const baseRect = obstacleToXYRect(obstacle)
    const rect = baseRect ? padRect(baseRect, obstacleClearance ?? 0) : null
    if (!rect) continue
    for (const z of obstacleZs(obstacle, zIndexByName)) {
      obstacleRectsByLayer[z]?.push(rect)
    }
  }

  for (const point of concretePoints) {
    const z = zIndexByName.get(point.layer.toLowerCase())
    if (typeof z !== "number" || z < 0 || z >= layerCount) continue

    const containingRects = (obstacleRectsByLayer[z] ?? []).filter(
      (rect) =>
        point.x >= rect.x - EPS &&
        point.x <= rect.x + rect.width + EPS &&
        point.y >= rect.y - EPS &&
        point.y <= rect.y + rect.height + EPS,
    )

    if (containingRects.length === 0) {
      pushIfFree({ x: point.x, y: point.y, z })
      continue
    }

    for (const rect of containingRects) {
      const clampedX = clamp(point.x, rect.x + EPS, rect.x + rect.width - EPS)
      const clampedY = clamp(point.y, rect.y + EPS, rect.y + rect.height - EPS)

      pushIfFree({ x: rect.x - delta, y: clampedY, z })
      pushIfFree({ x: rect.x + rect.width + delta, y: clampedY, z })
      pushIfFree({ x: clampedX, y: rect.y - delta, z })
      pushIfFree({ x: clampedX, y: rect.y + rect.height + delta, z })
    }
  }

  out.sort(
    (a, b) =>
      b.zSpanLen! - a.zSpanLen! ||
      b.distance - a.distance ||
      a.z - b.z ||
      a.x - b.x ||
      a.y - b.y,
  )

  return out
}
