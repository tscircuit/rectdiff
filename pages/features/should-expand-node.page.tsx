import { useMemo } from "react"
import { RectDiffExpansionSolver } from "lib/solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import { createTwoNodeExpansionInput } from "lib/fixtures/twoNodeExpansionFixture"
import { SolverDebugger3d } from "../../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(
    () => new RectDiffExpansionSolver(createTwoNodeExpansionInput()),
    [],
  )

  return <SolverDebugger3d solver={solver} />
}
