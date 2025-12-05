import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import simpleRouteJson from "../test-assets/outline.json"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(() => new RectDiffSolver({ simpleRouteJson }), [])

  return <SolverDebugger3d solver={solver} />
}
