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
import { buildObstacleIndexesByLayer } from "./buildObstacleIndexes"

export type RectDiffGridSolverPipelineInput = {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
  boardVoidRects?: XYRect[]
  layerNames?: string[]
  zIndexByName?: Map<string, number>
}

export class RectDiffGridSolverPipeline extends BasePipelineSolver<RectDiffGridSolverPipelineInput> {
  rectDiffSeedingSolver?: RectDiffSeedingSolver
  rectDiffExpansionSolver?: RectDiffExpansionSolver
  private obstacleIndexByLayer: Array<RBush<RTreeRect>>
  private layerNames: string[]
  private zIndexByName: Map<string, number>

  constructor(inputProblem: RectDiffGridSolverPipelineInput) {
    super(inputProblem)
    const { obstacleIndexByLayer, layerNames, zIndexByName } = buildObstacleIndexesByLayer({
      srj: inputProblem.simpleRouteJson,
      boardVoidRects: inputProblem.boardVoidRects,
    })
    this.obstacleIndexByLayer = obstacleIndexByLayer
    this.layerNames = inputProblem.layerNames ?? layerNames
    this.zIndexByName = inputProblem.zIndexByName ?? zIndexByName
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
          boardVoidRects: pipeline.inputProblem.boardVoidRects,
          layerNames: pipeline.layerNames,
          zIndexByName: pipeline.zIndexByName,
        },
      ],
    ),
    definePipelineStep(
      "rectDiffExpansionSolver",
      RectDiffExpansionSolver,
      (pipeline: RectDiffGridSolverPipeline) => {
        const output = pipeline.rectDiffSeedingSolver?.getOutput()
        if (!output) {
          throw new Error("RectDiffSeedingSolver did not produce output")
        }
        return [
          {
            srj: pipeline.inputProblem.simpleRouteJson,
            layerNames: output.layerNames ?? [],
            boardVoidRects: pipeline.inputProblem.boardVoidRects ?? [],
            layerCount: pipeline.inputProblem.simpleRouteJson.layerCount,
            bounds: output.bounds!,
            candidates: output.candidates,
            consumedSeedsThisGrid: output.placed.length,
            totalSeedsThisGrid: output.candidates.length,
            placed: output.placed,
            edgeAnalysisDone: output.edgeAnalysisDone,
            gridIndex: output.gridIndex,
            expansionIndex: output.expansionIndex,
            obstacleIndexByLayer: pipeline.obstacleIndexByLayer,
            options: output.options,
            zIndexByName: pipeline.zIndexByName,
            layerNamesCanonical: pipeline.layerNames,
          },
        ]
      },
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
