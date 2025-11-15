import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import simpleRouteJson from "../test-assets/example-simple-route.json"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"
import { useMemo } from "react"

export default () => {
  const solver = useMemo(
    () => new RectDiffSolver({ simpleRouteJson: simpleRouteJson }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
