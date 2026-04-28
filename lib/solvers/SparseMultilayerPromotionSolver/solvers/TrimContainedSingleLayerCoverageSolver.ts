import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type {
  CapacityMeshNode,
  CapacityMeshNodeId,
} from "../../../types/capacity-mesh-types"
import { getZLayerName } from "../../../math/layers/getZLayerName"
import { EPS } from "../../../utils/rectdiff-geometry"
import { cloneNode } from "../cloneNode"
import { cloneNodeWithRect } from "../cloneNodeWithRect"
import { getUsableMultilayerVolumeShare } from "../getUsableMultilayerVolumeShare"
import { isFreeNode } from "../isFreeNode"
import { nodeToRect } from "../nodeToRect"
import { getColorForZLayer } from "../../../utils/getColorForZLayer"
import { subtractRects } from "../../../math/rects/subtractRects"

type TrimContainedSingleLayerCoverageSolverInput = {
  meshNodes: CapacityMeshNode[]
  minRectSize: number
  promotionTargetShare: number
}

/**
 * Remove single-layer pieces that are already covered by shared space.
 * This keeps the result smaller and simpler.
 */
export class TrimContainedSingleLayerCoverageSolver extends BaseSolver {
  private nextResidualId = 0
  private outputNodes: CapacityMeshNode[] = []
  private residualNodeIds = new Set<CapacityMeshNodeId>()

  constructor(private input: TrimContainedSingleLayerCoverageSolverInput) {
    super()
  }

  override _setup() {
    this.nextResidualId = 0
    this.residualNodeIds.clear()
    this.outputNodes = this.input.meshNodes.map((node) => cloneNode({ node }))
  }

  override _step() {
    if (
      getUsableMultilayerVolumeShare({ nodes: this.outputNodes }) >=
      this.input.promotionTargetShare
    ) {
      this.solved = true
      return
    }

    const freeMultilayerNodes = this.outputNodes.filter(
      (node) => isFreeNode({ node }) && node.availableZ.length > 1,
    )
    const nextNodes: CapacityMeshNode[] = []

    for (const node of this.outputNodes) {
      if (!isFreeNode({ node }) || node.availableZ.length !== 1) {
        nextNodes.push(node)
        continue
      }

      const z = node.availableZ[0]!
      const coveringRects = freeMultilayerNodes
        .filter((candidate) => candidate.availableZ.includes(z))
        .map((candidate) => nodeToRect({ node: candidate }))

      if (coveringRects.length === 0) {
        nextNodes.push(node)
        continue
      }

      const nodeRect = nodeToRect({ node })
      const residuals = subtractRects({
        target: nodeRect,
        cutters: coveringRects,
      }).filter(
        (rect) =>
          rect.width + EPS >= this.input.minRectSize &&
          rect.height + EPS >= this.input.minRectSize,
      )

      if (
        residuals.length === 1 &&
        Math.abs(residuals[0]!.x - nodeRect.x) <= EPS &&
        Math.abs(residuals[0]!.y - nodeRect.y) <= EPS &&
        Math.abs(residuals[0]!.width - nodeRect.width) <= EPS &&
        Math.abs(residuals[0]!.height - nodeRect.height) <= EPS
      ) {
        nextNodes.push(node)
        continue
      }

      for (const rect of residuals) {
        const residualNode = cloneNodeWithRect({
          templateNode: node,
          rect,
          capacityMeshNodeId: `${node.capacityMeshNodeId}-contained-residual-${this.nextResidualId++}`,
        })
        this.residualNodeIds.add(residualNode.capacityMeshNodeId)
        nextNodes.push(residualNode)
      }
    }

    this.outputNodes = nextNodes
    this.solved = true
  }

  override getOutput() {
    return {
      outputNodes: this.outputNodes,
      residualNodeIds: this.residualNodeIds,
    }
  }

  override visualize(): GraphicsObject {
    return {
      title: "TrimContainedSingleLayerCoverageSolver",
      coordinateSystem: "cartesian",
      rects: this.outputNodes.map((node) => {
        const colors = getColorForZLayer(node.availableZ)
        const isResidual = this.residualNodeIds.has(node.capacityMeshNodeId)

        return {
          center: node.center,
          width: node.width,
          height: node.height,
          stroke: isResidual ? "rgba(14, 116, 144, 0.95)" : colors.stroke,
          fill: isResidual ? "rgba(34, 211, 238, 0.18)" : colors.fill,
          layer: getZLayerName({ availableZ: node.availableZ }),
        }
      }),
      points: [],
      lines: [],
      texts: [],
    }
  }
}
