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

    const gapFillMeshNodes: CapacityMeshNode[] = gapFillOutput.filledRects.map(
      (placed, index) => ({
        capacityMeshNodeId: `gap-fill-${index}`,
        x: placed.rect.x,
        y: placed.rect.y,
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        availableZ: placed.zLayers,
        layer: placed.zLayers[0]?.toString() ?? "0",
      }),
    )

    return {
      meshNodes: [...rectDiffOutput.meshNodes, ...gapFillMeshNodes],
    }
  }

  override visualize(): GraphicsObject {
    const gapFillSolver = this.getSolver<GapFillSolver>("gapFillSolver")
    const rectDiffSolver = this.getSolver<RectDiffSolver>("rectDiffSolver")

    if (gapFillSolver && !gapFillSolver.solved) {
      return gapFillSolver.visualize()
    }

    if (gapFillSolver?.solved && rectDiffSolver) {
      const baseViz = rectDiffSolver.visualize()
      const gapFillViz = gapFillSolver.visualize()

      return {
        ...baseViz,
        title: "RectDiff Pipeline (with Gap Fill)",
        rects: [...(baseViz.rects || []), ...(gapFillViz.rects || [])],
        lines: [...(baseViz.lines || []), ...(gapFillViz.lines || [])],
        points: [...(baseViz.points || []), ...(gapFillViz.points || [])],
      }
    }

    if (rectDiffSolver) {
      return rectDiffSolver.visualize()
    }

    // Show board and obstacles even before solver is initialized
    return createBaseVisualization(
      this.inputProblem.simpleRouteJson,
      "RectDiff Pipeline (not started)",
    )
  }
}
