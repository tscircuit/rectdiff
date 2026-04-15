import simpleRouteJson from "../../tests/solver/repros/merge-single-layer-node/merge-single-layer-node.json"
import { RectDiffPipeline } from "../../lib/RectDiffPipeline"
import { useMemo } from "react"
import { SolverDebugger3d } from "../../components/SolverDebugger3d"

export default () => {
  const problem = simpleRouteJson[0]!

  const solver = useMemo(() => new RectDiffPipeline(problem), [])

  return (
    <SolverDebugger3d
      solver={solver}
      simpleRouteJson={problem.simpleRouteJson}
    />
  )
}
