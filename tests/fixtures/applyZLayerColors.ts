import type { GraphicsObject } from "graphics-debug"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"

/**
 * Apply consistent fill/stroke colors to any rects whose
 * `layer` is a z-layer string (e.g. "z0" or "z0,1,3").
 *
 * Intended for use in visual snapshots so that colors are
 * derived only from the z-layer information.
 */
export const applyZLayerColors = (graphics: GraphicsObject): GraphicsObject => {
  const rects = (graphics.rects ?? []) as NonNullable<GraphicsObject["rects"]>

  const getLayersFromLayerField = (layer: unknown): number[] | null => {
    if (typeof layer !== "string") return null
    if (!layer.startsWith("z")) return null
    const rest = layer.slice(1)
    if (!rest) return null

    const values = rest
      .split(",")
      .map((part) => Number.parseInt(part, 10))
      .filter((value) => !Number.isNaN(value))

    return values.length ? values : null
  }

  const recoloredRects = rects.map((rect) => {
    const layers = getLayersFromLayerField((rect as any).layer)
    if (!layers) return rect

    const { fill, stroke } = getColorForZLayer(layers)

    return {
      ...rect,
      fill,
      stroke,
    }
  })

  return {
    ...graphics,
    rects: recoloredRects,
  }
}
