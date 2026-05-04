import { RectDiffPipeline } from "../../../lib/RectDiffPipeline"
import type { WorkerTaskMessage } from "../benchmark-types"
import { getAutorouterPipeline4ModulePath } from "./getAutorouterPipeline4ModulePath"
import { importRuntimeModule } from "./importRuntimeModule"
import type { Pipeline4Constructor } from "./types"

/**
 * Creates the benchmark solver with the local RectDiff pipeline override.
 * This keeps benchmark runs aligned with the repo's current implementation.
 */
export const createSolver = async (
  scenario: WorkerTaskMessage["task"]["scenario"],
) => {
  // Import Pipeline 4 directly from the installed package source so we avoid
  // the package root's unrelated re-exports while still using the local
  // RectDiffPipeline override for benchmarking.
  const solverModule = await importRuntimeModule(
    getAutorouterPipeline4ModulePath(),
  )

  // TODO: Replace this cast once capacity-autorouter exposes a typed
  // Pipeline 4 override interface. As of this repo state, the installed
  // Pipeline 4 constructor only exposes CapacityMeshSolverOptions and does
  // not type the benchmark's overrides.RectDiffPipelineClass injection.
  const AutoroutingPipelineSolver4 = (solverModule as any)
    .AutoroutingPipelineSolver4 as Pipeline4Constructor

  return new AutoroutingPipelineSolver4(scenario, {
    overrides: {
      RectDiffPipelineClass: RectDiffPipeline,
    },
  })
}
