import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type {
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "../../types/capacity-mesh-types"
import { getZLayerName } from "../../math/layers/getZLayerName"
import { getColorForZLayer } from "../../utils/getColorForZLayer"
import { CoalesceMultilayerTilesSolver } from "./solvers/CoalesceMultilayerTilesSolver"
import { PromoteSparseMultilayerCoverageSolver } from "./solvers/PromoteSparseMultilayerCoverageSolver"
import { TrimContainedSingleLayerCoverageSolver } from "./solvers/TrimContainedSingleLayerCoverageSolver"
import type { SparseMultilayerPromotionInput } from "./types"

/**
 * This pipeline makes shared multilayer regions easier to use.
 * It grows shared space, removes redundant leftovers, and combines small tiles.
 */
export class SparseMultilayerPromotionSolver extends BasePipelineSolver<SparseMultilayerPromotionInput> {
  coalesceMultilayerTilesSolver?: CoalesceMultilayerTilesSolver
  promoteSparseMultilayerCoverageSolver?: PromoteSparseMultilayerCoverageSolver
  trimContainedSingleLayerCoverageSolver?: TrimContainedSingleLayerCoverageSolver

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "promoteSparseMultilayerCoverageSolver",
      PromoteSparseMultilayerCoverageSolver,
      (solver: SparseMultilayerPromotionSolver) => [
        {
          meshNodes: solver.inputProblem.meshNodes,
          minRectSize: Math.max(
            solver.inputProblem.simpleRouteJson.minViaDiameter ?? 0,
            solver.inputProblem.simpleRouteJson.minTraceWidth ?? 0,
          ),
          promotionTargetShare: solver.inputProblem.promotionTargetShare,
        },
      ],
    ),
    definePipelineStep(
      "trimContainedSingleLayerCoverageSolver",
      TrimContainedSingleLayerCoverageSolver,
      (solver: SparseMultilayerPromotionSolver) => [
        {
          meshNodes:
            solver.promoteSparseMultilayerCoverageSolver?.getOutput()
              .outputNodes ?? solver.inputProblem.meshNodes,
          minRectSize: Math.max(
            solver.inputProblem.simpleRouteJson.minViaDiameter ?? 0,
            solver.inputProblem.simpleRouteJson.minTraceWidth ?? 0,
          ),
          promotionTargetShare: solver.inputProblem.promotionTargetShare,
        },
      ],
    ),
    definePipelineStep(
      "coalesceMultilayerTilesSolver",
      CoalesceMultilayerTilesSolver,
      (solver: SparseMultilayerPromotionSolver) => [
        {
          meshNodes:
            solver.trimContainedSingleLayerCoverageSolver?.getOutput()
              .outputNodes ??
            solver.promoteSparseMultilayerCoverageSolver?.getOutput()
              .outputNodes ??
            solver.inputProblem.meshNodes,
        },
      ],
    ),
  ]

  override getConstructorParams() {
    return [this.inputProblem]
  }

  override getOutput(): { outputNodes: CapacityMeshNode[] } {
    return {
      outputNodes:
        this.coalesceMultilayerTilesSolver?.getOutput().outputNodes ??
        this.trimContainedSingleLayerCoverageSolver?.getOutput().outputNodes ??
        this.promoteSparseMultilayerCoverageSolver?.getOutput().outputNodes ??
        this.inputProblem.meshNodes,
    }
  }

  override finalVisualize(): GraphicsObject {
    const promotedIds = new Set<CapacityMeshNodeId>([
      ...(this.promoteSparseMultilayerCoverageSolver?.getOutput()
        .promotedNodeIds ?? []),
      ...(this.coalesceMultilayerTilesSolver?.getOutput().promotedNodeIds ??
        []),
    ])
    const residualIds = new Set<CapacityMeshNodeId>([
      ...(this.promoteSparseMultilayerCoverageSolver?.getOutput()
        .residualNodeIds ?? []),
      ...(this.trimContainedSingleLayerCoverageSolver?.getOutput()
        .residualNodeIds ?? []),
    ])

    return {
      title: "SparseMultilayerPromotionSolver",
      coordinateSystem: "cartesian",
      rects: this.getOutput().outputNodes.map((node) => {
        const colors = getColorForZLayer(node.availableZ)
        const isPromoted = promotedIds.has(node.capacityMeshNodeId)
        const isResidual = residualIds.has(node.capacityMeshNodeId)

        return {
          center: node.center,
          width: node.width,
          height: node.height,
          stroke: isPromoted
            ? "rgba(168, 85, 247, 0.95)"
            : isResidual
              ? "rgba(14, 116, 144, 0.95)"
              : colors.stroke,
          fill: node._containsObstacle
            ? "rgba(239, 68, 68, 0.35)"
            : isPromoted
              ? "rgba(192, 132, 252, 0.28)"
              : isResidual
                ? "rgba(34, 211, 238, 0.18)"
                : colors.fill,
          layer: getZLayerName({ availableZ: node.availableZ }),
        }
      }),
      points: [],
      lines: [],
      texts: [],
    }
  }
}
