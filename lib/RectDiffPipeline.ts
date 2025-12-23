import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./rectdiff-types"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { GapFillSolverPipeline } from "./solvers/GapFillSolver/GapFillSolverPipeline"
import { RectDiffGridSolverPipeline } from "./solvers/RectDiffGridSolverPipeline/RectDiffGridSolverPipeline"
import { createBaseVisualization } from "./rectdiff-visualization"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffGridSolverPipeline?: RectDiffGridSolverPipeline
  gapFillSolver?: GapFillSolverPipeline

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "rectDiffGridSolverPipeline",
      RectDiffGridSolverPipeline,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          simpleRouteJson: rectDiffPipeline.inputProblem.simpleRouteJson,
          gridOptions: rectDiffPipeline.inputProblem.gridOptions,
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
    if (this.rectDiffGridSolverPipeline) {
      return this.rectDiffGridSolverPipeline.getOutput()
    }
    return { meshNodes: [] }
  }

  override initialVisualize(): GraphicsObject {
    console.log("RectDiffPipeline - initialVisualize")
    const graphics = createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiffPipeline - Initial",
    )

    // Show initial mesh nodes from grid pipeline if available
    const initialNodes =
      this.rectDiffGridSolverPipeline?.getOutput().meshNodes ?? []

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
      (this.rectDiffGridSolverPipeline?.getOutput().meshNodes ?? []).map(
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
