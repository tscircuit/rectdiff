import { useMemo } from "react"
import { GapFillSolver } from "../../../lib/solvers/GapFillSolver"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"
import type { Placed3D } from "../../../lib/solvers/rectdiff/types"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"

export default () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 1,
    minTraceWidth: 0.1,
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    connections: [],
    obstacles: [],
  }

  // Two rectangles staggered vertically with partial overlap
  const placedRects: Placed3D[] = [
    {
      rect: { x: 1, y: 2, width: 3, height: 4 },
      zLayers: [0],
    },
    {
      rect: { x: 5, y: 3, width: 3, height: 4 },
      zLayers: [0],
    },
  ]

  const solver = useMemo(
    () =>
      new GapFillSolver({
        simpleRouteJson,
        placedRects,
        obstaclesByLayer: [[]],
      }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
