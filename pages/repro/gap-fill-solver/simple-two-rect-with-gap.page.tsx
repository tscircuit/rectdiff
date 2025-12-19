import { useMemo } from "react"
import { EdgeSpatialHashIndex } from "../../../lib/solvers/GapFillSolver/EdgeSpatialHashIndex"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"
import type { Placed3D } from "../../../lib/solvers/rectdiff/types"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import testData from "../../../lib/solvers/GapFillSolver/test-cases/simple-two-rect-with-gap.json"

export default () => {
  const solver = useMemo(
    () =>
      new EdgeSpatialHashIndex({
        simpleRouteJson: testData.simpleRouteJson as SimpleRouteJson,
        placedRects: testData.placedRects as Placed3D[],
        obstaclesByLayer: testData.obstaclesByLayer,
        maxEdgeDistance: testData.maxEdgeDistance ?? undefined,
      }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
