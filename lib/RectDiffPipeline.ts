import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./solvers/rectdiff/types"
import { RectDiffSolver } from "./solvers/RectDiffSolver"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { createBaseVisualization } from "./solvers/rectdiff/visualization"
import { GapFillSolverPipeline } from "./solvers/GapFillSolver/GapFillSolverPipeline"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffSolver?: RectDiffSolver
  gapFillSolver?: GapFillSolverPipeline

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "rectDiffSolver",
      RectDiffSolver,
      (rectDiffPipeline) => [
        {
          simpleRouteJson: rectDiffPipeline.inputProblem.simpleRouteJson,
          gridOptions: rectDiffPipeline.inputProblem.gridOptions,
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
      GapFillSolverPipeline,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          meshNodes:
            rectDiffPipeline.rectDiffSolver?.getOutput().meshNodes ?? [],
        },
      ],
    ),
  ]

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    const gapFillOutput = this.gapFillSolver?.getOutput()
    if (gapFillOutput) {
      return { meshNodes: gapFillOutput.outputNodes }
    }
    return this.rectDiffSolver!.getOutput()
  }

  override initialVisualize(): GraphicsObject {
    console.log("RectDiffPipeline - initialVisualize")
    const graphics = createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiffPipeline - Initial",
    )

    // Show initial mesh nodes from rectDiffSolver if available
    const initialNodes = this.rectDiffSolver?.getOutput().meshNodes ?? []
    for (const node of initialNodes) {
      graphics.rects!.push({
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
      })
    }

    return graphics
  }

  override finalVisualize(): GraphicsObject {
    const graphics = createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiffPipeline - Final",
    )

    const { meshNodes: outputNodes } = this.getOutput()
    const initialNodeIds = new Set(
      (this.rectDiffSolver?.getOutput().meshNodes ?? []).map(
        (n) => n.capacityMeshNodeId,
      ),
    )

    for (const node of outputNodes) {
      const isExpanded = !initialNodeIds.has(node.capacityMeshNodeId)
      graphics.rects!.push({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: isExpanded ? "rgba(0, 128, 0, 0.8)" : "rgba(0, 0, 0, 0.3)",
        fill: isExpanded ? "rgba(0, 200, 0, 0.3)" : "rgba(100, 100, 100, 0.1)",
        layer: `z${node.availableZ.join(",")}`,
        label: [
          `${isExpanded ? "[expanded] " : ""}node ${node.capacityMeshNodeId}`,
          `z:${node.availableZ.join(",")}`,
        ].join("\n"),
      })
    }

    return graphics
  }
}
