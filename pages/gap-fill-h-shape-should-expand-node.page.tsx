import fixture from "../test-assets/gap-fill-h-shape-should-expand-node.json"
import { GapFillSolverPipeline } from "../lib/solvers/GapFillSolver/GapFillSolverPipeline"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(
    () =>
      new GapFillSolverPipeline({
        meshNodes: fixture.meshNodes as CapacityMeshNode[],
      }),
    [],
  )

  return (
    <SolverDebugger3d
      solver={solver}
      defaultShowOutput={true}
      defaultShowRoot={true}
    />
  )
}
