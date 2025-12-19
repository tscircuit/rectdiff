import { useMemo } from "react"
import { GapFillSolver } from "../../../lib/solvers/GapFillSolver/GapFillSolver"
import type { SimpleRouteJson } from "../../../lib/types/srj-types"
import type { Placed3D } from "../../../lib/solvers/rectdiff/types"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import testData from "../../../test-assets/gap-fill/three-rects-tall-short-tall.json"

export default () => {
  const solver = useMemo(
    () =>
      new GapFillSolver({
        simpleRouteJson: testData.simpleRouteJson as SimpleRouteJson,
        placedRects: testData.placedRects as Placed3D[],
        obstaclesByLayer: testData.obstaclesByLayer,
        maxEdgeDistance: testData.maxEdgeDistance ?? undefined,
      }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
