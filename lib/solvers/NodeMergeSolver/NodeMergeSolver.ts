import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { Placed3D, Rect3d, XYRect } from "lib/rectdiff-types"
import { CoverageMergeSolver } from "./CoverageMergeSolver"
import { MaskGenerationSolver } from "./MaskGenerationSolver"
import { ObstacleInjectionSolver } from "./ObstacleInjectionSolver"
import { PlacementDiffSolver } from "./PlacementDiffSolver"
import type { ObstacleEntry } from "./shared"

export type NodeMergeSolverInput = {
  placed: Placed3D[]
  boardVoidRects: XYRect[]
  mergedObstacles: ObstacleEntry[]
  maxAspectRatio?: number | null
}

export class NodeMergeSolver extends BasePipelineSolver<NodeMergeSolverInput> {
  placementDiffSolver?: PlacementDiffSolver
  maskGenerationSolver?: MaskGenerationSolver
  coverageMergeSolver?: CoverageMergeSolver
  obstacleInjectionSolver?: ObstacleInjectionSolver

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "placementDiffSolver",
      PlacementDiffSolver,
      (pipeline: NodeMergeSolver) => [
        {
          placed: pipeline.inputProblem.placed,
        },
      ],
    ),
    definePipelineStep(
      "maskGenerationSolver",
      MaskGenerationSolver,
      (pipeline: NodeMergeSolver) => {
        const output = pipeline.placementDiffSolver?.getOutput()
        if (!output) throw new Error("PlacementDiffSolver did not produce output")
        return [output]
      },
    ),
    definePipelineStep(
      "coverageMergeSolver",
      CoverageMergeSolver,
      (pipeline: NodeMergeSolver) => {
        const output = pipeline.maskGenerationSolver?.getOutput()
        if (!output) throw new Error("MaskGenerationSolver did not produce output")
        return [
          {
            ...output,
            maxAspectRatio: pipeline.inputProblem.maxAspectRatio,
          },
        ]
      },
    ),
    definePipelineStep(
      "obstacleInjectionSolver",
      ObstacleInjectionSolver,
      (pipeline: NodeMergeSolver) => {
        const output = pipeline.coverageMergeSolver?.getOutput()
        if (!output) throw new Error("CoverageMergeSolver did not produce output")
        return [
          {
            coverageRects: output.coverageRects,
            mergedObstacles: pipeline.inputProblem.mergedObstacles,
            maxAspectRatio: pipeline.inputProblem.maxAspectRatio,
          },
        ]
      },
    ),
  ]

  override getOutput(): { meshNodes: CapacityMeshNode[]; rects: Rect3d[] } {
    if (this.obstacleInjectionSolver) {
      return this.obstacleInjectionSolver.getOutput()
    }
    if (this.coverageMergeSolver) {
      const output = this.coverageMergeSolver.getOutput()
      return {
        meshNodes: [],
        rects: output.coverageRects,
      }
    }
    return {
      meshNodes: [],
      rects: [],
    }
  }

  override visualize(): GraphicsObject {
    if (this.obstacleInjectionSolver) {
      return this.obstacleInjectionSolver.visualize()
    }
    if (this.coverageMergeSolver) {
      return this.coverageMergeSolver.visualize()
    }
    if (this.maskGenerationSolver) {
      return this.maskGenerationSolver.visualize()
    }
    if (this.placementDiffSolver) {
      return this.placementDiffSolver.visualize()
    }
    return {
      title: "Node Merge Pipeline",
      coordinateSystem: "cartesian",
      rects: [],
      points: [],
      lines: [],
    }
  }
}
