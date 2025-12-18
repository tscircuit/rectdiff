import { useMemo } from "react"
import { GapFillSolver } from "../../../lib/solvers/GapFillSolver"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"
import type { Placed3D } from "../../../lib/solvers/rectdiff/types"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"

export default () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    connections: [],
    obstacles: [],
  }

  // Multiple layers with gaps
  const placedRects: Placed3D[] = [
    // Layer 0 - horizontal gap
    {
      rect: { x: 1, y: 2, width: 2, height: 3 },
      zLayers: [0],
    },
    {
      rect: { x: 5, y: 2, width: 2, height: 3 },
      zLayers: [0],
    },
    // Layer 1 - vertical gap
    {
      rect: { x: 3, y: 6, width: 4, height: 2 },
      zLayers: [1],
    },
    {
      rect: { x: 3, y: 1, width: 4, height: 2 },
      zLayers: [1],
    },
  ]

  const solver = useMemo(
    () =>
      new GapFillSolver({
        simpleRouteJson,
        placedRects,
        obstaclesByLayer: [[], []],
      }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
