import { BasePipelineSolver, definePipelineStep } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./solvers/rectdiff/types"
import { RectDiffSolver } from "./solvers/RectDiffSolver"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffSolver?: RectDiffSolver

  override pipelineDef = [
    definePipelineStep(
      "rectDiffSolver",
      RectDiffSolver,
      (instance) => [
        {
          simpleRouteJson: instance.inputProblem.simpleRouteJson,
          gridOptions: instance.inputProblem.gridOptions,
        },
      ],
      {
        onSolved: () => {
          // RectDiff mesh generation completed
        },
      },
    ),
  ]

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    return this.getSolver<RectDiffSolver>("rectDiffSolver")!.getOutput()
  }

  override visualize(): GraphicsObject {
    const solver = this.getSolver<RectDiffSolver>("rectDiffSolver")
    if (solver) {
      return solver.visualize()
    }
    // Return empty visualization if solver not initialized yet
    return {
      title: "RectDiff Pipeline (initializing...)",
      coordinateSystem: "cartesian",
      rects: [],
      points: [],
      lines: [],
    }
  }
}
