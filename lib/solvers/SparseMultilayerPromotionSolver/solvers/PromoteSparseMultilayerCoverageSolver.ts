import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type {
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "../../../types/capacity-mesh-types"
import { getZLayerName } from "../../../math/layers/getZLayerName"
import { getColorForZLayer } from "../../../utils/getColorForZLayer"
import { cloneNode } from "../cloneNode"
import { cloneNodeWithRect } from "../cloneNodeWithRect"
import { createResidualNodes } from "../createResidualNodes"
import { findBestPromotionCandidate } from "../findBestPromotionCandidate"
import { getUsableMultilayerVolumeShare } from "../getUsableMultilayerVolumeShare"

type PromoteSparseMultilayerCoverageSolverInput = {
  meshNodes: CapacityMeshNode[]
  minRectSize: number
  promotionTargetShare: number
}

/**
 * Turn overlapping single-layer space into shared space.
 * It runs until the configured shared-space threshold is reached.
 */
export class PromoteSparseMultilayerCoverageSolver extends BaseSolver {
  private nextMergedId = 0
  private nextResidualId = 0
  private outputNodes: CapacityMeshNode[] = []
  private promotedNodeIds = new Set<CapacityMeshNodeId>()
  private residualNodeIds = new Set<CapacityMeshNodeId>()
  private workingNodes: CapacityMeshNode[] = []

  constructor(private input: PromoteSparseMultilayerCoverageSolverInput) {
    super()
  }

  override _setup() {
    this.nextMergedId = 0
    this.nextResidualId = 0
    this.promotedNodeIds.clear()
    this.residualNodeIds.clear()
    this.workingNodes = this.input.meshNodes.map((node) => cloneNode({ node }))
    this.outputNodes = [...this.workingNodes]
  }

  override _step() {
    if (
      getUsableMultilayerVolumeShare({ nodes: this.workingNodes }) >=
      this.input.promotionTargetShare
    ) {
      this.outputNodes = [...this.workingNodes]
      this.solved = true
      return
    }

    const candidate = findBestPromotionCandidate({
      minRectSize: this.input.minRectSize,
      nodes: this.workingNodes,
    })
    if (!candidate) {
      this.outputNodes = [...this.workingNodes]
      this.solved = true
      return
    }

    const { sourceNode, targetNode } = candidate
    if (!sourceNode || !targetNode) {
      this.outputNodes = [...this.workingNodes]
      this.solved = true
      return
    }

    const mergedNode = cloneNodeWithRect({
      templateNode: sourceNode,
      rect: candidate.rect,
      capacityMeshNodeId: `sparse-multilayer-merge-${this.nextMergedId++}`,
      availableZ: candidate.unionZ,
    })
    this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)

    this.workingNodes = [
      ...this.workingNodes.filter(
        (node) =>
          node.capacityMeshNodeId !== sourceNode.capacityMeshNodeId &&
          node.capacityMeshNodeId !== targetNode.capacityMeshNodeId,
      ),
      mergedNode,
      ...createResidualNodes({
        cutRect: candidate.rect,
        getNextResidualId: () => this.nextResidualId++,
        idPrefix: `${sourceNode.capacityMeshNodeId}-sparse-residual`,
        node: sourceNode,
        onResidualNodeIdCreated: (nodeId) => this.residualNodeIds.add(nodeId),
      }),
      ...createResidualNodes({
        cutRect: candidate.rect,
        getNextResidualId: () => this.nextResidualId++,
        idPrefix: `${targetNode.capacityMeshNodeId}-sparse-residual`,
        node: targetNode,
        onResidualNodeIdCreated: (nodeId) => this.residualNodeIds.add(nodeId),
      }),
    ]

    this.outputNodes = [...this.workingNodes]
  }

  override getOutput() {
    return {
      outputNodes: this.outputNodes,
      promotedNodeIds: this.promotedNodeIds,
      residualNodeIds: this.residualNodeIds,
    }
  }

  override visualize(): GraphicsObject {
    return {
      title: "PromoteSparseMultilayerCoverageSolver",
      coordinateSystem: "cartesian",
      rects: this.outputNodes.map((node) => {
        const colors = getColorForZLayer(node.availableZ)
        const isPromoted = this.promotedNodeIds.has(node.capacityMeshNodeId)
        const isResidual = this.residualNodeIds.has(node.capacityMeshNodeId)

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
