import type { GraphicsObject, Line, Point, Rect } from "graphics-debug"

export function getPerLayerVisualizations(
  graphics: GraphicsObject,
): Map<string, GraphicsObject> {
  const rects = (graphics.rects ?? []) as NonNullable<Rect[]>
  const lines = (graphics.lines ?? []) as NonNullable<Line[]>
  const points = (graphics.points ?? []) as NonNullable<Point[]>

  const zValues = new Set<number>()

  const addZValuesFromLayer = (layer: string) => {
    if (!layer.startsWith("z")) return
    const rest = layer.slice(1)
    if (!rest) return
    for (const part of rest.split(",")) {
      const value = Number.parseInt(part, 10)
      if (!Number.isNaN(value)) zValues.add(value)
    }
  }

  for (const rect of rects) addZValuesFromLayer(rect.layer!)
  for (const line of lines) addZValuesFromLayer(line.layer!)
  for (const point of points) addZValuesFromLayer(point.layer!)

  const result = new Map<string, GraphicsObject>()
  if (!zValues.size) return result

  const sortedZ = Array.from(zValues).sort((a, b) => a - b)

  const commonRects: NonNullable<Rect[]> = []
  const perLayerRects: { layers: number[]; rect: Rect }[] = []

  for (const rect of rects) {
    const layer = rect.layer!
    if (layer.startsWith("z")) {
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

  const commonLines: NonNullable<Line[]> = []
  const perLayerLines: { layers: number[]; line: Line }[] = []

  for (const line of lines) {
    const layer = line.layer!
    if (layer.startsWith("z")) {
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

  const commonPoints: NonNullable<Point[]> = []
  const perLayerPoints: { layers: number[]; point: Point }[] = []

  for (const point of points) {
    const layer = point.layer!
    if (layer.startsWith("z")) {
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

  const allCombos: number[][] = [[]]
  for (const z of sortedZ) {
    const withZ = allCombos.map((combo) => [...combo, z])
    allCombos.push(...withZ)
  }

  for (const combo of allCombos.filter((c) => c.length > 0)) {
    const key = `z${combo.join(",")}`

    const layerRects: NonNullable<Rect[]> = [...commonRects]
    const layerLines: NonNullable<Line[]> = [...commonLines]
    const layerPoints: NonNullable<Point[]> = [...commonPoints]

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
