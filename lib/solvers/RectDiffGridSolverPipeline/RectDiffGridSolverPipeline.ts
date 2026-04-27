import type { Bounds } from "@tscircuit/math-utils"
import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type RBush from "rbush"
import type { GridFill3DOptions, XYRect } from "../../rectdiff-types"
import type {
  CapacityMeshNode,
  RTreeRect,
} from "../../types/capacity-mesh-types"
import type {
  Obstacle,
  SimpleRouteConnection,
  SimpleRouteJson,
} from "../../types/srj-types"
import { MergeToMaximizeLargeMultiLayerNodesPipelineSolver } from "../MergeToMaximizeLargeMultiLayerNodes/MergeToMaximizeLargeMultiLayerNodesPipelineSolver"
import { RectDiffExpansionSolver } from "../RectDiffExpansionSolver/RectDiffExpansionSolver"
import { RectDiffSeedingSolver } from "../RectDiffSeedingSolver/RectDiffSeedingSolver"
import { buildObstacleIndexesByLayer } from "./buildObstacleIndexes"

export type RectDiffGridSolverPipelineInput = {
  bounds: Bounds
  obstacles: Obstacle[]
  connections: SimpleRouteConnection[]
  outline?: Pick<SimpleRouteJson, "outline">
  layerCount: number
  minTraceWidth: number
  obstacleClearance?: number
  gridOptions?: Partial<GridFill3DOptions>
  boardVoidRects?: XYRect[]
  layerNames?: string[]
  zIndexByName?: Map<string, number>
}

export class RectDiffGridSolverPipeline extends BasePipelineSolver<RectDiffGridSolverPipelineInput> {
  rectDiffSeedingSolver?: RectDiffSeedingSolver
  rectDiffExpansionSolver?: RectDiffExpansionSolver
  mergeToMaximizeLargeMultiLayerNodes?: MergeToMaximizeLargeMultiLayerNodesPipelineSolver
  private obstacleIndexByLayer: Array<RBush<RTreeRect>>
  private layerNames: string[]
  private zIndexByName: Map<string, number>

  constructor(inputProblem: RectDiffGridSolverPipelineInput) {
    super(inputProblem)
    const { obstacleIndexByLayer, layerNames, zIndexByName } =
      buildObstacleIndexesByLayer({
        srj: {
          bounds: inputProblem.bounds,
          obstacles: inputProblem.obstacles,
          connections: inputProblem.connections,
          outline: inputProblem.outline?.outline,
          layerCount: inputProblem.layerCount,
          minTraceWidth: inputProblem.minTraceWidth,
        },
        boardVoidRects: inputProblem.boardVoidRects,
        obstacleClearance: inputProblem.obstacleClearance,
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
          simpleRouteJson: {
            bounds: pipeline.inputProblem.bounds,
            obstacles: pipeline.inputProblem.obstacles,
            connections: pipeline.inputProblem.connections,
            outline: pipeline.inputProblem.outline?.outline,
            layerCount: pipeline.inputProblem.layerCount,
            minTraceWidth: pipeline.inputProblem.minTraceWidth,
          },
          gridOptions: pipeline.inputProblem.gridOptions,
          obstacleIndexByLayer: pipeline.obstacleIndexByLayer,
          boardVoidRects: pipeline.inputProblem.boardVoidRects,
          layerNames: pipeline.layerNames,
          zIndexByName: pipeline.zIndexByName,
          obstacleClearance: pipeline.inputProblem.obstacleClearance,
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
            layerNames: output.layerNames ?? [],
            boardVoidRects: pipeline.inputProblem.boardVoidRects ?? [],
            layerCount: pipeline.inputProblem.layerCount,
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
            obstacles: pipeline.inputProblem.obstacles,
            obstacleClearance: pipeline.inputProblem.obstacleClearance,
          },
        ]
      },
    ),
    definePipelineStep(
      "mergeToMaximizeLargeMultiLayerNodes",
      MergeToMaximizeLargeMultiLayerNodesPipelineSolver,
      (pipeline: RectDiffGridSolverPipeline) => {
        const output = pipeline.rectDiffExpansionSolver?.getOutput()
        if (!output) {
          throw new Error("RectDiffExpansionSolver did not produce output")
        }
        return [
          {
            placed: output.placed,
            obstacles: pipeline.inputProblem.obstacles,
            layerCount: pipeline.inputProblem.layerCount,
            zIndexByName: pipeline.zIndexByName,
            obstacleClearance: pipeline.inputProblem.obstacleClearance,
          },
        ]
      },
    ),
  ]

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    if (this.mergeToMaximizeLargeMultiLayerNodes) {
      return this.mergeToMaximizeLargeMultiLayerNodes.getOutput()
    }
    if (this.rectDiffExpansionSolver) {
      return { meshNodes: this.rectDiffExpansionSolver.getOutput().meshNodes }
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
    if (this.mergeToMaximizeLargeMultiLayerNodes) {
      return this.mergeToMaximizeLargeMultiLayerNodes.visualize()
    }
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
