import { useMemo } from "react"
import { EdgeSpatialHashIndex } from "../../../lib/solvers/GapFillSolver/EdgeSpatialHashIndex"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"
import type { Placed3D } from "../../../lib/solvers/rectdiff/types"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"

export default () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 1,
    minTraceWidth: 0.1,
    bounds: { minX: 0, minY: 0, maxX: 12, maxY: 12 },
    connections: [],
    obstacles: [],
  }

  // Four rectangles forming a cross with gaps
  const placedRects: Placed3D[] = [
    // Left
    {
      rect: { x: 1, y: 5, width: 3, height: 2 },
      zLayers: [0],
    },
    // Right
    {
      rect: { x: 8, y: 5, width: 3, height: 2 },
      zLayers: [0],
    },
    // Top
    {
      rect: { x: 5, y: 8, width: 2, height: 3 },
      zLayers: [0],
    },
    // Bottom
    {
      rect: { x: 5, y: 1, width: 2, height: 3 },
      zLayers: [0],
    },
  ]

  const solver = useMemo(
    () =>
      new EdgeSpatialHashIndex({
        simpleRouteJson,
        placedRects,
        obstaclesByLayer: [[]],
      }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
