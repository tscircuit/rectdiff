import type { Placed3D, Rect3d } from "../rectdiff-types"

const rectKey = (rect: {
  minX: number
  minY: number
  maxX: number
  maxY: number
}) => `${rect.minX}:${rect.minY}:${rect.maxX}:${rect.maxY}`

export function partitionPlacedRectsByCoverage(placed: Placed3D[]): Rect3d[] {
  if (placed.length === 0) return []

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
  const maxLayer = placed.reduce(
    (currentMax, placement) =>
      Math.max(currentMax, ...placement.zLayers, currentMax),
    0,
  )
  const layerCount = maxLayer + 1

  const layerDiffs = Array.from({ length: layerCount }, () =>
    Array.from({ length: ys.length + 1 }, () => new Int32Array(xs.length + 1)),
  )

  for (const placement of placed) {
    const x1 = xIndex.get(placement.rect.x)
    const x2 = xIndex.get(placement.rect.x + placement.rect.width)
    const y1 = yIndex.get(placement.rect.y)
    const y2 = yIndex.get(placement.rect.y + placement.rect.height)
    if (
      x1 === undefined ||
      x2 === undefined ||
      y1 === undefined ||
      y2 === undefined
    ) {
      continue
    }

    for (const z of placement.zLayers) {
      const diff = layerDiffs[z]
      if (!diff) continue
      diff[y1]![x1]! += 1
      diff[y2]![x1]! -= 1
      diff[y1]![x2]! -= 1
      diff[y2]![x2]! += 1
    }
  }

  const layerMasks = Array.from({ length: ys.length - 1 }, () =>
    new Uint32Array(xs.length - 1),
  )

  for (let z = 0; z < layerCount; z++) {
    const diff = layerDiffs[z]!
    for (let y = 0; y < ys.length - 1; y++) {
      let rowRunning = 0
      for (let x = 0; x < xs.length - 1; x++) {
        rowRunning += diff[y]![x]!
        const cellCount = rowRunning + (y > 0 ? diff[y - 1]![x]! : 0)
        diff[y]![x] = cellCount
        if (cellCount > 0) {
          layerMasks[y]![x]! |= 1 << z
        }
      }
    }
  }

  const activeRects = new Map<
    string,
    {
      minX: number
      maxX: number
      minY: number
      maxY: number
      mask: number
    }
  >()
  const out: Rect3d[] = []

  for (let y = 0; y < ys.length - 1; y++) {
    const nextActiveKeys = new Set<string>()
    let x = 0
    while (x < xs.length - 1) {
      const mask = layerMasks[y]![x]!
      if (mask === 0) {
        x += 1
        continue
      }
      const xStart = x
      x += 1
      while (x < xs.length - 1 && layerMasks[y]![x] === mask) x += 1

      const key = `${mask}:${xs[xStart]}:${xs[x]}`
      const existing = activeRects.get(key)
      if (existing && existing.maxY === ys[y]) {
        existing.maxY = ys[y + 1]!
      } else {
        if (existing) {
          out.push({
            minX: existing.minX,
            minY: existing.minY,
            maxX: existing.maxX,
            maxY: existing.maxY,
            zLayers: Array.from({ length: layerCount }, (_, zIndex) => zIndex)
              .filter((zIndex) => (existing.mask & (1 << zIndex)) !== 0),
          })
        }
        activeRects.set(key, {
          minX: xs[xStart]!,
          maxX: xs[x]!,
          minY: ys[y]!,
          maxY: ys[y + 1]!,
          mask,
        })
      }
      nextActiveKeys.add(key)
    }

    for (const [key, rect] of Array.from(activeRects.entries())) {
      if (!nextActiveKeys.has(key)) {
        out.push({
          minX: rect.minX,
          minY: rect.minY,
          maxX: rect.maxX,
          maxY: rect.maxY,
          zLayers: Array.from({ length: layerCount }, (_, zIndex) => zIndex)
            .filter((zIndex) => (rect.mask & (1 << zIndex)) !== 0),
        })
        activeRects.delete(key)
      }
    }
  }

  for (const rect of activeRects.values()) {
    out.push({
      minX: rect.minX,
      minY: rect.minY,
      maxX: rect.maxX,
      maxY: rect.maxY,
      zLayers: Array.from({ length: layerCount }, (_, zIndex) => zIndex).filter(
        (zIndex) => (rect.mask & (1 << zIndex)) !== 0,
      ),
    })
  }

  const mergedByFootprint = new Map<
    string,
    {
      minX: number
      minY: number
      maxX: number
      maxY: number
      zLayers: Set<number>
    }
  >()

  for (const rect of out) {
    const key = rectKey(rect)
    let entry = mergedByFootprint.get(key)
    if (!entry) {
      entry = {
        minX: rect.minX,
        minY: rect.minY,
        maxX: rect.maxX,
        maxY: rect.maxY,
        zLayers: new Set<number>(),
      }
      mergedByFootprint.set(key, entry)
    }
    for (const z of rect.zLayers) entry.zLayers.add(z)
  }

  return Array.from(mergedByFootprint.values(), (entry) => ({
    minX: entry.minX,
    minY: entry.minY,
    maxX: entry.maxX,
    maxY: entry.maxY,
    zLayers: Array.from(entry.zLayers).sort((a, b) => a - b),
  }))
}
