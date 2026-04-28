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
import { findBestCoalesceCandidate } from "../findBestCoalesceCandidate"

type CoalesceMultilayerTilesSolverInput = {
  meshNodes: CapacityMeshNode[]
}

/**
 * Collapse tiled shared nodes into larger boxes one step at a time.
 * The solver stops when there are no fully covered merge boxes left.
 */
export class CoalesceMultilayerTilesSolver extends BaseSolver {
  private nextMergedId = 0
  private outputNodes: CapacityMeshNode[] = []
  private promotedNodeIds = new Set<CapacityMeshNodeId>()
  private workingNodes: CapacityMeshNode[] = []

  constructor(private input: CoalesceMultilayerTilesSolverInput) {
    super()
  }

  override _setup() {
    this.nextMergedId = 0
    this.promotedNodeIds.clear()
    this.workingNodes = this.input.meshNodes.map((node) => cloneNode({ node }))
    this.outputNodes = [...this.workingNodes]
  }

  override _step() {
    const candidate = findBestCoalesceCandidate({ nodes: this.workingNodes })
    if (!candidate) {
      this.outputNodes = [...this.workingNodes]
      this.solved = true
      return
    }

    const absorbedNodeIds = new Set<CapacityMeshNodeId>(
      candidate.absorbedNodes.map((node) => node.capacityMeshNodeId),
    )
    const templateNode = this.workingNodes.find((node) =>
      absorbedNodeIds.has(node.capacityMeshNodeId),
    )
    if (!templateNode) {
      this.outputNodes = [...this.workingNodes]
      this.solved = true
      return
    }

    const mergedNode = cloneNodeWithRect({
      templateNode,
      rect: candidate.rect,
      capacityMeshNodeId: `sparse-coalesced-${this.nextMergedId++}`,
    })
    this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)

    this.workingNodes = [
      ...this.workingNodes.filter(
        (node) => !absorbedNodeIds.has(node.capacityMeshNodeId),
      ),
      mergedNode,
    ]

    this.outputNodes = [...this.workingNodes]
  }

  override getOutput() {
    return {
      outputNodes: this.outputNodes,
      promotedNodeIds: this.promotedNodeIds,
    }
  }

  override visualize(): GraphicsObject {
    return {
      title: "CoalesceMultilayerTilesSolver",
      coordinateSystem: "cartesian",
      rects: this.outputNodes.map((node) => {
        const colors = getColorForZLayer(node.availableZ)
        const isPromoted = this.promotedNodeIds.has(node.capacityMeshNodeId)

        return {
          center: node.center,
          width: node.width,
          height: node.height,
          stroke: isPromoted ? "rgba(168, 85, 247, 0.95)" : colors.stroke,
          fill: isPromoted ? "rgba(192, 132, 252, 0.28)" : colors.fill,
          layer: getZLayerName({ availableZ: node.availableZ }),
        }
      }),
      points: [],
      lines: [],
      texts: [],
    }
  }
}
