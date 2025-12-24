import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "lib/types/srj-types"
import type { GridFill3DOptions, XYRect } from "lib/rectdiff-types"
import type { CapacityMeshNode, RTreeRect } from "lib/types/capacity-mesh-types"
import { RectDiffSeedingSolver } from "lib/solvers/RectDiffSeedingSolver/RectDiffSeedingSolver"
import { RectDiffExpansionSolver } from "lib/solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import type { GraphicsObject } from "graphics-debug"
import RBush from "rbush"
import { buildObstacleIndexes } from "./buildObstacleIndexes"

export type RectDiffGridSolverPipelineInput = {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffGridSolverPipeline extends BasePipelineSolver<RectDiffGridSolverPipelineInput> {
  rectDiffSeedingSolver?: RectDiffSeedingSolver
  rectDiffExpansionSolver?: RectDiffExpansionSolver
  private boardVoidRects?: XYRect[]
  private obstacleIndexByLayer: Array<RBush<RTreeRect>>

  constructor(inputProblem: RectDiffGridSolverPipelineInput) {
    super(inputProblem)
    const { obstacleIndexByLayer, boardVoidRects } = buildObstacleIndexes(
      inputProblem.simpleRouteJson,
    )
    this.obstacleIndexByLayer = obstacleIndexByLayer
    this.boardVoidRects = boardVoidRects
  }

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "rectDiffSeedingSolver",
      RectDiffSeedingSolver,
      (pipeline: RectDiffGridSolverPipeline) => [
        {
          simpleRouteJson: pipeline.inputProblem.simpleRouteJson,
          gridOptions: pipeline.inputProblem.gridOptions,
          obstacleIndexByLayer: pipeline.obstacleIndexByLayer,
          boardVoidRects: pipeline.boardVoidRects,
        },
      ],
    ),
    definePipelineStep(
      "rectDiffExpansionSolver",
      RectDiffExpansionSolver,
      (pipeline: RectDiffGridSolverPipeline) => [
        {
          initialSnapshot: {
            ...pipeline.rectDiffSeedingSolver!.getOutput(),
            boardVoidRects: pipeline.boardVoidRects ?? [],
          },
          obstacleIndexByLayer: pipeline.obstacleIndexByLayer,
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
