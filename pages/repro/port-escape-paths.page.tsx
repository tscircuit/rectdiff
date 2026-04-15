import inputProblems from "tests/solver/repros/port-escape-paths/port-escape-paths.json"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import { useMemo } from "react"
import { SolverDebugger3d } from "components/SolverDebugger3d"

export default () => {
  const problem = inputProblems[0]!

  const solver = useMemo(() => new RectDiffPipeline(problem), [])

  return (
    <SolverDebugger3d
      solver={solver}
      simpleRouteJson={problem.simpleRouteJson}
    />
  )
}
