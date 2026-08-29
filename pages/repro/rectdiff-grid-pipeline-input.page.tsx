import inputProblems from "tests/solver/repros/rectdiff-grid-pipeline-input/rectdiff-grid-pipeline-input.json"
import {
  RectDiffGridSolverPipeline,
  type RectDiffGridSolverPipelineInput,
} from "lib/solvers/RectDiffGridSolverPipeline/RectDiffGridSolverPipeline"
import type { SimpleRouteJson } from "lib/types/srj-types"
import { useMemo } from "react"
import { SolverDebugger3d } from "components/SolverDebugger3d"

const rawProblem = inputProblems[0]!

function normalizeProblem(
  problem: typeof rawProblem,
): RectDiffGridSolverPipelineInput {
  const zIndexEntries = Object.entries(problem.zIndexByName ?? {}).map(
    ([layerName, zIndex]) => [layerName, Number(zIndex)] as const,
  )

  return {
    ...problem,
    zIndexByName: new Map(zIndexEntries),
  } as RectDiffGridSolverPipelineInput
}

function toSimpleRouteJson(
  problem: RectDiffGridSolverPipelineInput,
): SimpleRouteJson {
  return {
    bounds: problem.bounds,
    obstacles: problem.obstacles,
    connections: problem.connections,
    outline: problem.outline?.outline,
    layerCount: problem.layerCount,
    minTraceWidth: problem.minTraceWidth,
  }
}

export default () => {
  const { solver, simpleRouteJson } = useMemo(() => {
    const problem = normalizeProblem(rawProblem)

    return {
      solver: new RectDiffGridSolverPipeline(problem),
      simpleRouteJson: toSimpleRouteJson(problem),
    }
  }, [])

  return <SolverDebugger3d solver={solver} simpleRouteJson={simpleRouteJson} />
}
