import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./solvers/rectdiff/types"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { GapFillSolverPipeline } from "./solvers/GapFillSolver/GapFillSolverPipeline"
import { RectDiffGridSolver } from "./solvers/RectDiffGridSolver/RectDiffGridSolver"
import { RectDiffExpansionSolver } from "./solvers/RectDiffExpansionSolver/RectDiffExpansionSolver"
import { createBaseVisualization } from "./solvers/rectdiff/visualization"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffGridSolver?: RectDiffGridSolver
  rectDiffExpansionSolver?: RectDiffExpansionSolver
  gapFillSolver?: GapFillSolverPipeline

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "rectDiffGridSolver",
      RectDiffGridSolver,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          simpleRouteJson: rectDiffPipeline.inputProblem.simpleRouteJson,
          gridOptions: rectDiffPipeline.inputProblem.gridOptions,
        },
      ],
      {
        onSolved: () => {
          // Grid phase completed
        },
      },
    ),
    definePipelineStep(
      "rectDiffExpansionSolver",
      RectDiffExpansionSolver,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          initialSnapshot: rectDiffPipeline.rectDiffGridSolver!.getOutput(),
        },
      ],
      {
        onSolved: () => {
          // Expansion phase completed
        },
      },
    ),
    definePipelineStep(
      "gapFillSolver",
      GapFillSolverPipeline,
      (rectDiffPipeline: RectDiffPipeline) => [
        {
          meshNodes:
            rectDiffPipeline.rectDiffExpansionSolver?.getOutput().meshNodes ??
            [],
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
    if (this.rectDiffExpansionSolver) {
      return this.rectDiffExpansionSolver.getOutput()
    }
    if (this.rectDiffGridSolver) {
      const snapshot = this.rectDiffGridSolver.getOutput()
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

  override initialVisualize(): GraphicsObject {
    console.log("RectDiffPipeline - initialVisualize")
    const graphics = createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiffPipeline - Initial",
    )

    // Show initial mesh nodes from expansion/grid solver if available
    const initialNodes =
      this.rectDiffExpansionSolver?.getOutput().meshNodes ??
      this.getOutput().meshNodes

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
      (this.rectDiffExpansionSolver?.getOutput().meshNodes ?? []).map(
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
