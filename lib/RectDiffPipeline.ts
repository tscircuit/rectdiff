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
    const rectDiffOutput =
      this.getSolver<RectDiffSolver>("rectDiffSolver")!.getOutput()
    const gapFillSolver = this.getSolver<GapFillSolver>("gapFillSolver")

    if (!gapFillSolver) {
      return rectDiffOutput
    }

    const gapFillOutput = gapFillSolver.getOutput()

    return {
      meshNodes: [...rectDiffOutput.meshNodes, ...gapFillOutput.meshNodes],
    }
  }

  override visualize(): GraphicsObject {
    const gapFillSolver = this.getSolver<GapFillSolver>("gapFillSolver")
    const rectDiffSolver = this.getSolver<RectDiffSolver>("rectDiffSolver")

    if (gapFillSolver && !gapFillSolver.solved) {
      return gapFillSolver.visualize()
    }

    if (rectDiffSolver) {
      const baseViz = rectDiffSolver.visualize()
      if (gapFillSolver?.solved) {
        const gapFillOutput = gapFillSolver.getOutput()
        const gapFillRects = gapFillOutput.meshNodes.map((node) => {
          const minZ = Math.min(...node.availableZ)
          const colors = [
            { fill: "#dbeafe", stroke: "#3b82f6" },
            { fill: "#fef3c7", stroke: "#f59e0b" },
            { fill: "#d1fae5", stroke: "#10b981" },
          ]
          const color = colors[minZ % colors.length]!

          return {
            center: node.center,
            width: node.width,
            height: node.height,
            fill: color.fill,
            stroke: color.stroke,
            label: `capacity node (gap fill)\nz: [${node.availableZ.join(", ")}]`,
          }
        })

        return {
          ...baseViz,
          title: "RectDiff Pipeline (with Gap Fill)",
          rects: [...(baseViz.rects || []), ...gapFillRects],
        }
      }

      return baseViz
    }

    // Show board and obstacles even before solver is initialized
    return createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiff Pipeline (not started)",
    )
  }
}
