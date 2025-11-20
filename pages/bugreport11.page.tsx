import simpleRouteJson from "../test-assets/bugreport11-b2de3c.json"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(() => new RectDiffSolver({ simpleRouteJson: simpleRouteJson.simple_route_json }), [])

  return <SolverDebugger3d solver={solver} />
}
