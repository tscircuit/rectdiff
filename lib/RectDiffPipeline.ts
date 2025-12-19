import { BasePipelineSolver, definePipelineStep } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./solvers/rectdiff/types"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { createBaseVisualization } from "./solvers/rectdiff/visualization"
import type { GridSolverOutput } from "./solvers/grid/GridSolver"
import { GridSolver } from "./solvers/grid/GridSolver"
import {
  ExpansionSolver,
  type ExpansionSolverOutput,
} from "./solvers/expansion/ExpansionSolver"
import { visualizeRectDiffState } from "./solvers/rectdiff/visualizeRectDiffState"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffSolver?: ExpansionSolver

  override pipelineDef = [
    definePipelineStep("gridSolver", GridSolver, (instance) => [
      {
        simpleRouteJson: instance.inputProblem.simpleRouteJson,
        gridOptions: instance.inputProblem.gridOptions,
      },
    ]),

    definePipelineStep(
      "expansionSolver",
      ExpansionSolver,
      (instance) => {
        const gridOutput =
          instance.getStepOutput<GridSolverOutput>("gridSolver")
        if (!gridOutput) {
          throw new Error(
            "RectDiffPipeline: gridSolver output is required before expansion",
          )
        }
        return [
          {
            initialState: gridOutput.rectDiffState,
          },
        ]
      },
      {
        onSolved: (instance) => {
          const expansionSolver =
            instance.getSolver<ExpansionSolver>("expansionSolver")
          ;(instance as RectDiffPipeline).rectDiffSolver = expansionSolver
        },
      },
    ),
  ]

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    const expansionOutput =
      this.getStepOutput<ExpansionSolverOutput>("expansionSolver")

    if (expansionOutput) {
      return { meshNodes: expansionOutput.meshNodes }
    }

    return { meshNodes: [] }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const expansionOutput =
      this.getStepOutput<ExpansionSolverOutput>("expansionSolver")
    if (this.solved && expansionOutput) {
      return visualizeRectDiffState(
        expansionOutput.rectDiffState,
        this.inputProblem.simpleRouteJson,
      )
    }

    return createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiff Pipeline (not started)",
    )
  }
}
