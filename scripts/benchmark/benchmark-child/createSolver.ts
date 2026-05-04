import { RectDiffPipeline } from "../../../lib/RectDiffPipeline"
import type { WorkerTaskMessage } from "../benchmark-types"
import { getAutorouterPipeline4ModulePath } from "./getAutorouterPipeline4ModulePath"
import { importRuntimeModule } from "./importRuntimeModule"
import type { Pipeline4Constructor } from "./types"

/**
 * Creates the benchmark solver with the repo-local RectDiff pipeline override.
 * The benchmark imports Pipeline 4 from the published autorouter bundle while
 * forcing it to instantiate this repo's RectDiff implementation by default.
 */
export const createSolver = async (
  scenario: WorkerTaskMessage["task"]["scenario"],
  RectDiffPipelineClass: typeof RectDiffPipeline = RectDiffPipeline,
) => {
  // Load Pipeline 4 from the installed capacity-autorouter dist bundle, then
  // inject the RectDiff class explicitly through its runtime override hook.
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
      RectDiffPipelineClass,
    },
  })
}
