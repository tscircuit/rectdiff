import type { GraphicsObject } from "graphics-debug"

export function getPerLayerVisualizations(
  graphics: GraphicsObject,
): Map<string, GraphicsObject> {
  const rects = (graphics.rects ?? []) as NonNullable<GraphicsObject["rects"]>
  const lines = (graphics.lines ?? []) as NonNullable<GraphicsObject["lines"]>
  const points = (graphics.points ?? []) as NonNullable<
    GraphicsObject["points"]
  >

  const zValues = new Set<number>()

  const addZValuesFromLayer = (layer: unknown) => {
    if (typeof layer !== "string") return
    if (!layer.startsWith("z")) return
    const rest = layer.slice(1)
    if (!rest) return
    for (const part of rest.split(",")) {
      const value = Number.parseInt(part, 10)
      if (!Number.isNaN(value)) zValues.add(value)
    }
  }

  for (const rect of rects) addZValuesFromLayer((rect as any).layer)
  for (const line of lines) addZValuesFromLayer((line as any).layer)
  for (const point of points) addZValuesFromLayer((point as any).layer)

  const result = new Map<string, GraphicsObject>()
  if (!zValues.size) return result

  const sortedZ = Array.from(zValues).sort((a, b) => a - b)

  const commonRects: NonNullable<GraphicsObject["rects"]> = []
  const perLayerRects: { layers: number[]; rect: (typeof rects)[number] }[] = []

  for (const rect of rects) {
    const layer = (rect as any).layer
    if (typeof layer === "string" && layer.startsWith("z")) {
      const rest = layer.slice(1)
      if (rest) {
        const layers = rest
          .split(",")
          .map((part) => Number.parseInt(part, 10))
          .filter((value) => !Number.isNaN(value))
        if (layers.length) {
          perLayerRects.push({ layers, rect })
          continue
        }
      }
    }
    commonRects.push(rect)
  }

  const commonLines: NonNullable<GraphicsObject["lines"]> = []
  const perLayerLines: { layers: number[]; line: (typeof lines)[number] }[] = []

  for (const line of lines) {
    const layer = (line as any).layer
    if (typeof layer === "string" && layer.startsWith("z")) {
      const rest = layer.slice(1)
      if (rest) {
        const layers = rest
          .split(",")
          .map((part) => Number.parseInt(part, 10))
          .filter((value) => !Number.isNaN(value))
        if (layers.length) {
          perLayerLines.push({ layers, line })
          continue
        }
      }
    }
    commonLines.push(line)
  }

  const commonPoints: NonNullable<GraphicsObject["points"]> = []
  const perLayerPoints: { layers: number[]; point: (typeof points)[number] }[] =
    []

  for (const point of points) {
    const layer = (point as any).layer
    if (typeof layer === "string" && layer.startsWith("z")) {
      const rest = layer.slice(1)
      if (rest) {
        const layers = rest
          .split(",")
          .map((part) => Number.parseInt(part, 10))
          .filter((value) => !Number.isNaN(value))
        if (layers.length) {
          perLayerPoints.push({ layers, point })
          continue
        }
      }
    }
    commonPoints.push(point)
  }

  // Generate all non-empty combinations (power set) of z values
  const comboCount = 1 << sortedZ.length

  for (let mask = 1; mask < comboCount; mask++) {
    const combo: number[] = []
    for (let i = 0; i < sortedZ.length; i++) {
      if (mask & (1 << i)) combo.push(sortedZ[i]!)
    }

    const key = `z${combo.join(",")}`

    const layerRects: NonNullable<GraphicsObject["rects"]> = [...commonRects]
    const layerLines: NonNullable<GraphicsObject["lines"]> = [...commonLines]
    const layerPoints: NonNullable<GraphicsObject["points"]> = [...commonPoints]

    const intersects = (layers: number[]) =>
      layers.some((layer) => combo.includes(layer))

    for (const { layers, rect } of perLayerRects) {
      if (intersects(layers)) layerRects.push(rect)
    }
    for (const { layers, line } of perLayerLines) {
      if (intersects(layers)) layerLines.push(line)
    }
    for (const { layers, point } of perLayerPoints) {
      if (intersects(layers)) layerPoints.push(point)
    }

    result.set(key, {
      title: `${graphics.title ?? ""} - z${combo.join(",")}`,
      coordinateSystem: graphics.coordinateSystem,
      rects: layerRects,
      lines: layerLines,
      points: layerPoints,
    })
  }

  return result
}