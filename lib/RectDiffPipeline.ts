import { BasePipelineSolver, definePipelineStep } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./solvers/rectdiff/types"
import { RectDiffSolver } from "./solvers/RectDiffSolver"
import { GapFillSolver } from "./solvers/GapFillSolver"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { createBaseVisualization } from "./solvers/rectdiff/visualization"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffSolver?: RectDiffSolver
  gapFillSolver?: GapFillSolver
  override MAX_ITERATIONS: number = 100e6

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
    definePipelineStep(
      "gapFillSolver",
      GapFillSolver,
      (instance) => {
        const rectDiffSolver =
          instance.getSolver<RectDiffSolver>("rectDiffSolver")!
        const rectDiffState = (rectDiffSolver as any).state

        return [
          {
            simpleRouteJson: instance.inputProblem.simpleRouteJson,
            placedRects: rectDiffState.placed || [],
            obstaclesByLayer: rectDiffState.obstaclesByLayer || [],
          },
        ]
      },
      {
        onSolved: () => {
          // Gap fill completed
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
    // Show the currently active solver's visualization
    const gapFillSolver = this.getSolver<GapFillSolver>("gapFillSolver")
    if (gapFillSolver && !gapFillSolver.solved) {
      // Gap fill is running, show its visualization
      return gapFillSolver.visualize()
    }

    const rectDiffSolver = this.getSolver<RectDiffSolver>("rectDiffSolver")
    if (rectDiffSolver) {
      // RectDiff is running or finished, show its visualization
      return rectDiffSolver.visualize()
    }

    // Show board and obstacles even before solver is initialized
    return createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiff Pipeline (not started)",
    )
  }
}
