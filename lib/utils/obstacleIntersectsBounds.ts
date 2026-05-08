import type { Bounds } from "@tscircuit/math-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import { obstacleToXYRect } from "../solvers/RectDiffSeedingSolver/layers"
import { clipXYRectToBounds } from "./clipXYRectToBounds"

type Obstacle = NonNullable<SimpleRouteJson["obstacles"]>[number]

/**
 * Checks whether an obstacle has any usable overlap with the board area.
 *
 * In general terms, this answers "does any part of this obstacle actually land
 * on the board?" Obstacles fully outside the board return `false`.
 */
export const obstacleIntersectsBounds = (
  obstacle: Obstacle,
  bounds: Bounds,
): boolean => {
  const rect = obstacleToXYRect(obstacle)
  if (!rect) return false
  return clipXYRectToBounds(rect, bounds) !== null
}
