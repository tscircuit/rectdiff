import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "lib/types/srj-types"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import { FindSegmentsWithAdjacentEmptySpaceSolver } from "./FindSegmentsWithAdjacentEmptySpaceSolver"
import { ExpandEdgesToEmptySpaceSolver } from "./ExpandEdgesToEmptySpaceSolver"
import { constructInputNodesFromSimpleRouteJson } from "./constructInputNodesFromSimpleRouteJson"

export class GapFillSolverPipeline extends BasePipelineSolver<{
  meshNodes: CapacityMeshNode[]
}> {
  findEdgesWithAdjacentEmptySpaceSolver?: FindSegmentsWithAdjacentEmptySpaceSolver
  expandEdgesToEmptySpaceSolver?: ExpandEdgesToEmptySpaceSolver

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "findEdgesWithAdjacentEmptySpace",
      FindSegmentsWithAdjacentEmptySpaceSolver,
      (gapFillPipeline) => [
        {
          meshNodes: gapFillPipeline.inputProblem.meshNodes,
        },
      ],
      {
        onSolved: () => {
          // Gap fill solver completed
        },
      },
    ),
    definePipelineStep(
      "expandEdgesToEmptySpace",
      ExpandEdgesToEmptySpaceSolver,
      (gapFillPipeline: GapFillSolverPipeline) => [
        {
          inputMeshNodes: gapFillPipeline.inputProblem.meshNodes,
          edgesWithAdjacentEmptySpace:
            gapFillPipeline.findEdgesWithAdjacentEmptySpaceSolver!.getOutput()
              .edgesWithAdjacentEmptySpace,
        },
      ],
      {
        onSolved: () => {
          // Gap fill solver completed
        },
      },
    ),
  ] as const
}
