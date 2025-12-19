import { BasePipelineSolver, definePipelineStep } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "./types/srj-types"
import type { GridFill3DOptions } from "./solvers/rectdiff/types"
import { RectDiffSolver } from "./solvers/RectDiffSolver"
import { GapFillSolverRepeater } from "./solvers/GapFillSolver/GapFillSolverManager"
import type { CapacityMeshNode } from "./types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { createBaseVisualization } from "./solvers/rectdiff/visualization"

export interface RectDiffPipelineInput {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
  /** Maximum distance between edges to consider for gap filling (default: 10) */
  gapFillMaxEdgeDistance?: number
  /** Number of gap fill iterations to run (default: 3) */
  gapFillIterations?: number
}

export class RectDiffPipeline extends BasePipelineSolver<RectDiffPipelineInput> {
  rectDiffSolver?: RectDiffSolver
  gapFillSolver?: GapFillSolverRepeater
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
      GapFillSolverRepeater,
      (instance) => {
        const rectDiffSolver =
          instance.getSolver<RectDiffSolver>("rectDiffSolver")!
        const rectDiffState = (rectDiffSolver as any).state

        return [
          {
            simpleRouteJson: instance.inputProblem.simpleRouteJson,
            placedRects: rectDiffState.placed || [],
            obstaclesByLayer: rectDiffState.obstaclesByLayer || [],
            maxEdgeDistance: instance.inputProblem.gapFillMaxEdgeDistance ?? 10,
            repeatCount: instance.inputProblem.gapFillIterations ?? 3,
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
    const gapFillSolver = this.getSolver<GapFillSolverRepeater>("gapFillSolver")

    if (!gapFillSolver) {
      return rectDiffOutput
    }

    const gapFillOutput = gapFillSolver.getOutput()

    return {
      meshNodes: [...rectDiffOutput.meshNodes, ...gapFillOutput.filledRects],
    }
  }

  override visualize(): GraphicsObject {
    const gapFillSolver = this.getSolver<GapFillSolverRepeater>("gapFillSolver")
    const rectDiffSolver = this.getSolver<RectDiffSolver>("rectDiffSolver")

    if (gapFillSolver && !gapFillSolver.solved) {
      return gapFillSolver.visualize()
    }

    if (rectDiffSolver) {
      const baseViz = rectDiffSolver.visualize()
      if (gapFillSolver?.solved) {
        const gapFillOutput = gapFillSolver.getOutput()
        const gapFillRects = gapFillOutput.filledRects.map((node) => {
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
