import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions, XYRect } from "./rectdiff-types"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { GapFillSolverPipeline } from "./solvers/GapFillSolver/GapFillSolverPipeline"
import { RectDiffGridSolverPipeline } from "./solvers/RectDiffGridSolverPipeline/RectDiffGridSolverPipeline"
import { createBaseVisualization } from "./rectdiff-visualization"
import { buildFinalRectDiffVisualization } from "./buildFinalRectDiffVisualization"
import { computeInverseRects } from "./solvers/RectDiffSeedingSolver/computeInverseRects"
import { buildZIndexMap } from "./solvers/RectDiffSeedingSolver/layers"
import { buildObstacleClearanceGraphics } from "./utils/renderObstacleClearance"
import { mergeGraphics } from "graphics-debug"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
  obstacleClearance?: number
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffGridSolverPipeline?: RectDiffGridSolverPipeline
  gapFillSolver?: GapFillSolverPipeline
  boardVoidRects: XYRect[] | undefined
  zIndexByName?: Map<string, number>
  layerNames?: string[]

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "rectDiffGridSolverPipeline",
      RectDiffGridSolverPipeline,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          bounds: rectDiffPipeline.inputProblem.simpleRouteJson.bounds,
          obstacles: rectDiffPipeline.inputProblem.simpleRouteJson.obstacles,
          connections:
            rectDiffPipeline.inputProblem.simpleRouteJson.connections,
          outline: rectDiffPipeline.inputProblem.simpleRouteJson.outline
            ? { outline: rectDiffPipeline.inputProblem.simpleRouteJson.outline }
            : undefined,
          layerCount: rectDiffPipeline.inputProblem.simpleRouteJson.layerCount,
          gridOptions: rectDiffPipeline.inputProblem.gridOptions,
          boardVoidRects: rectDiffPipeline.boardVoidRects,
          layerNames: rectDiffPipeline.layerNames,
          zIndexByName: rectDiffPipeline.zIndexByName,
          minTraceWidth:
            rectDiffPipeline.inputProblem.simpleRouteJson.minTraceWidth,
          obstacleClearance: rectDiffPipeline.inputProblem.obstacleClearance,
        },
      ],
    ),
    definePipelineStep(
      "gapFillSolver",
      GapFillSolverPipeline,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          meshNodes:
            rectDiffPipeline.rectDiffGridSolverPipeline?.getOutput()
              .meshNodes ?? [],
          boardVoid: {
            boardVoidRects: rectDiffPipeline.boardVoidRects || [],
            layerCount:
              rectDiffPipeline.inputProblem.simpleRouteJson.layerCount || 0,
          },
        },
      ],
    ),
  ]

  override _setup(): void {
    const { zIndexByName, layerNames } = buildZIndexMap({
      obstacles: this.inputProblem.simpleRouteJson.obstacles,
      layerCount: this.inputProblem.simpleRouteJson.layerCount,
    })
    this.zIndexByName = zIndexByName
    this.layerNames = layerNames
    if (this.inputProblem.simpleRouteJson.outline) {
      this.boardVoidRects = computeInverseRects(
        {
          x: this.inputProblem.simpleRouteJson.bounds.minX,
          y: this.inputProblem.simpleRouteJson.bounds.minY,
          width:
            this.inputProblem.simpleRouteJson.bounds.maxX -
            this.inputProblem.simpleRouteJson.bounds.minX,
          height:
            this.inputProblem.simpleRouteJson.bounds.maxY -
            this.inputProblem.simpleRouteJson.bounds.minY,
        },
        this.inputProblem.simpleRouteJson.outline ?? [],
      )
    }
  }

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    const gapFillOutput = this.gapFillSolver?.getOutput()
    if (gapFillOutput) {
      return { meshNodes: gapFillOutput.outputNodes }
    }
    if (this.rectDiffGridSolverPipeline) {
      return this.rectDiffGridSolverPipeline.getOutput()
    }
    return { meshNodes: [] }
  }

  override initialVisualize(): GraphicsObject {
    const base = createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiffPipeline - Initial",
    )
    const clearance = buildObstacleClearanceGraphics({
      srj: this.inputProblem.simpleRouteJson,
      clearance: this.inputProblem.obstacleClearance,
    })

    // Show initial mesh nodes from grid pipeline if available
    const initialNodes =
      this.rectDiffGridSolverPipeline?.getOutput().meshNodes ?? []

    const nodeRects: GraphicsObject = {
      title: "Initial Nodes",
      coordinateSystem: "cartesian",
      rects: initialNodes.map((node) => ({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "rgba(0, 0, 0, 0.3)",
        fill: "rgba(100, 100, 100, 0.1)",
        layer: `z${node.availableZ.join(",")}`,
        label: [
          `node ${node.capacityMeshNodeId}`,
          `z:${node.availableZ.join(",")}`,
        ].join("\n"),
      })),
    }

    return mergeGraphics(mergeGraphics(base, clearance), nodeRects)
  }

  override finalVisualize(): GraphicsObject {
    return buildFinalRectDiffVisualization({
      srj: this.inputProblem.simpleRouteJson,
      meshNodes: this.getOutput().meshNodes,
      obstacleClearance: this.inputProblem.obstacleClearance,
    })
  }
}
