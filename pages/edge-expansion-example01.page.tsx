import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import simpleRouteJson from "../test-assets/example01.json"
import { EdgeExpansionSolver } from "../lib/solvers/EdgeExpansionSolver"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"
import { EDGE_EXPANSION_CONFIG } from "../edge-expansion.config"

export default () => {
  const solver = useMemo(() => {
    const s = new EdgeExpansionSolver({
      simpleRouteJson,
      options: {
        minRequiredExpandSpace: EDGE_EXPANSION_CONFIG.MIN_REQUIRED_EXPAND_SPACE,
      },
    })
    s.setup() // Initialize the solver so initial nodes are visible
    return s
  }, [])

  return <SolverDebugger3d solver={solver} />
}

