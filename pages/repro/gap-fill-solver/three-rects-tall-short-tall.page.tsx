import { useMemo } from "react"
import { GapFillSolver } from "../../../lib/solvers/GapFillSolver"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"
import type { Placed3D } from "../../../lib/solvers/rectdiff/types"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"

export default () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 1,
    minTraceWidth: 0.1,
    bounds: { minX: 0, minY: 0, maxX: 15, maxY: 10 },
    connections: [],
    obstacles: [],
  }

  const placedRects: Placed3D[] = [
    {
      rect: { x: 1, y: 1, width: 3, height: 8 },
      zLayers: [0],
    },
    {
      rect: { x: 6, y: 3.5, width: 3, height: 3 },
      zLayers: [0],
    },
    {
      rect: { x: 11, y: 1, width: 3, height: 8 },
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
