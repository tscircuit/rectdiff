import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { GridFill3DOptions } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { RectDiffSeedingSolver } from "../RectDiffSeedingSolver/RectDiffSeedingSolver"
import { RectDiffExpansionSolver } from "../RectDiffExpansionSolver/RectDiffExpansionSolver"
import type { GraphicsObject } from "graphics-debug"

export type RectDiffGridSolverPipelineInput = {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffGridSolverPipeline extends BasePipelineSolver<RectDiffGridSolverPipelineInput> {
  rectDiffSeedingSolver?: RectDiffSeedingSolver
  rectDiffExpansionSolver?: RectDiffExpansionSolver

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "rectDiffSeedingSolver",
      RectDiffSeedingSolver,
      (pipeline: RectDiffGridSolverPipeline) => [
        {
          simpleRouteJson: pipeline.inputProblem.simpleRouteJson,
          gridOptions: pipeline.inputProblem.gridOptions,
        },
      ],
    ),
    definePipelineStep(
      "rectDiffExpansionSolver",
      RectDiffExpansionSolver,
      (pipeline: RectDiffGridSolverPipeline) => [
        {
          initialSnapshot: pipeline.rectDiffSeedingSolver!.getOutput(),
        },
      ],
    ),
  ]

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    if (this.rectDiffExpansionSolver) {
      return this.rectDiffExpansionSolver.getOutput()
    }
    if (this.rectDiffSeedingSolver) {
      const snapshot = this.rectDiffSeedingSolver.getOutput()
      const meshNodes: CapacityMeshNode[] = snapshot.placed.map(
        (placement: any, idx: number) => ({
          capacityMeshNodeId: `grid-${idx}`,
          center: {
            x: placement.rect.x + placement.rect.width / 2,
            y: placement.rect.y + placement.rect.height / 2,
          },
          width: placement.rect.width,
          height: placement.rect.height,
          availableZ: placement.zLayers,
          layer: `z${placement.zLayers.join(",")}`,
        }),
      )
      return { meshNodes }
    }
    return { meshNodes: [] }
  }

  override visualize(): GraphicsObject {
    if (this.rectDiffExpansionSolver) {
      return this.rectDiffExpansionSolver.visualize()
    }
    if (this.rectDiffSeedingSolver) {
      return this.rectDiffSeedingSolver.visualize()
    }
    return {
      title: "RectDiff Grid Pipeline",
      coordinateSystem: "cartesian",
      rects: [],
      points: [],
      lines: [],
    }
  }
}
