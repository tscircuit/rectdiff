import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { Placed3D } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { Obstacle } from "../../types/srj-types"
import { rectsToMeshNodes } from "../RectDiffExpansionSolver/rectsToMeshNodes"
import { MergeToMaximizeLargeMultiLayerNodesSolver } from "./MergeToMaximizeLargeMultiLayerNodesSolver"

export type MergeToMaximizeLargeMultiLayerNodesPipelineSolverInput = {
  placed: Placed3D[]
  obstacles: Obstacle[]
  layerCount: number
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}

export class MergeToMaximizeLargeMultiLayerNodesPipelineSolver extends BaseSolver {
  private meshNodes: CapacityMeshNode[] = []

  constructor(
    private input: MergeToMaximizeLargeMultiLayerNodesPipelineSolverInput,
  ) {
    super()
  }

  override _step() {
    const mergeSolver = new MergeToMaximizeLargeMultiLayerNodesSolver(
      this.input,
    )
    mergeSolver.solve()
    const rects = mergeSolver.getOutput().rects
    this.meshNodes = rectsToMeshNodes(rects)
    this.solved = true
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    return { meshNodes: this.meshNodes }
  }

  override visualize(): GraphicsObject {
    return {
      title: "MergeToMaximizeLargeMultiLayerNodes",
      coordinateSystem: "cartesian",
      rects: this.meshNodes.map((node) => ({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "rgba(124, 58, 237, 0.9)",
        fill: node._containsObstacle
          ? "rgba(239, 68, 68, 0.25)"
          : "rgba(196, 181, 253, 0.25)",
        layer: `z${node.availableZ.join(",")}`,
        label: `z:${node.availableZ.join(",")}`,
      })),
      points: [],
      lines: [],
      texts: [],
    }
  }
}
