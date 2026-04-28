import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { XYRect } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { SimpleRouteJson } from "../../types/srj-types"
import { getColorForZLayer } from "../../utils/getColorForZLayer"
import { EPS, subtractRect2D } from "../../utils/rectdiff-geometry"

type SparseMultilayerPromotionSolverInput = {
  meshNodes: CapacityMeshNode[]
  simpleRouteJson: SimpleRouteJson
}

type PromotionCandidate = {
  rect: XYRect
  sourceNodeId: string
  targetNodeId: string
  unionZ: number[]
  area: number
}

type CoalesceCandidate = {
  rect: XYRect
  absorbedNodeIds: string[]
  score: number
}

type SolverPhase = "promote" | "trim" | "coalesce" | "done"

const SPARSE_PROMOTION_TARGET_SHARE = 0.86

const nodeToRect = (node: CapacityMeshNode): XYRect => ({
  x: node.center.x - node.width / 2,
  y: node.center.y - node.height / 2,
  width: node.width,
  height: node.height,
})

const rectArea = (rect: XYRect) => rect.width * rect.height

const cloneNode = (node: CapacityMeshNode): CapacityMeshNode => ({
  ...node,
  center: { ...node.center },
  availableZ: [...node.availableZ],
})

const cloneNodeWithRect = ({
  templateNode,
  rect,
  capacityMeshNodeId,
  availableZ = templateNode.availableZ,
}: {
  templateNode: CapacityMeshNode
  rect: XYRect
  capacityMeshNodeId: string
  availableZ?: number[]
}): CapacityMeshNode => ({
  ...templateNode,
  capacityMeshNodeId,
  center: {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  },
  width: rect.width,
  height: rect.height,
  availableZ: [...availableZ],
  layer: `z${availableZ.join(",")}`,
})

const isFreeNode = (node: CapacityMeshNode) =>
  !node._containsObstacle && !node._containsTarget

const intersectRects = (a: XYRect, b: XYRect): XYRect | null => {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.width, b.x + b.width)
  const y1 = Math.min(a.y + a.height, b.y + b.height)

  if (x1 <= x0 + EPS || y1 <= y0 + EPS) return null

  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
  }
}

const mergeRects = (a: XYRect, b: XYRect): XYRect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
  height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
})

const areRectsAlignedForMerge = (a: XYRect, b: XYRect) => {
  const sameVerticalBand =
    Math.abs(a.x - b.x) <= EPS &&
    Math.abs(a.width - b.width) <= EPS &&
    a.y <= b.y + b.height + EPS &&
    b.y <= a.y + a.height + EPS

  const sameHorizontalBand =
    Math.abs(a.y - b.y) <= EPS &&
    Math.abs(a.height - b.height) <= EPS &&
    a.x <= b.x + b.width + EPS &&
    b.x <= a.x + a.width + EPS

  return sameVerticalBand || sameHorizontalBand
}

const rectsTouchOrOverlap = (a: XYRect, b: XYRect) =>
  a.x <= b.x + b.width + EPS &&
  b.x <= a.x + a.width + EPS &&
  a.y <= b.y + b.height + EPS &&
  b.y <= a.y + a.height + EPS

const rectContainsRect = (outer: XYRect, inner: XYRect) =>
  inner.x + EPS >= outer.x &&
  inner.y + EPS >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width + EPS &&
  inner.y + inner.height <= outer.y + outer.height + EPS

const subtractRects = (target: XYRect, cutters: XYRect[]) => {
  let remaining: XYRect[] = [target]

  for (const cutter of cutters) {
    if (remaining.length === 0) return remaining
    remaining = remaining.flatMap((piece) => subtractRect2D(piece, cutter))
  }

  return remaining
}

const getUnionZ = (a: number[], b: number[]) =>
  [...new Set([...a, ...b])].sort((x, y) => x - y)

const hasContiguousZSpan = (zValues: number[]) => {
  for (let i = 1; i < zValues.length; i++) {
    if (zValues[i]! - zValues[i - 1]! !== 1) return false
  }
  return true
}

const getUsableMultilayerVolumeShare = (nodes: CapacityMeshNode[]) => {
  let totalVolume = 0
  let obstacleVolume = 0
  let multilayerVolume = 0

  for (const node of nodes) {
    const volume = node.width * node.height * node.availableZ.length
    totalVolume += volume

    if (node._containsObstacle) {
      obstacleVolume += volume
      continue
    }

    if (node.availableZ.length > 1) {
      multilayerVolume += volume
    }
  }

  const usableVolume = totalVolume - obstacleVolume
  if (usableVolume <= EPS) return 0
  return multilayerVolume / usableVolume
}

export class SparseMultilayerPromotionSolver extends BaseSolver {
  private baseMinRectSize = 0
  private nextMergedId = 0
  private nextResidualId = 0
  private outputNodes: CapacityMeshNode[] = []
  private phase: SolverPhase = "promote"
  private promotedNodeIds = new Set<string>()
  private residualNodeIds = new Set<string>()
  private workingNodes: CapacityMeshNode[] = []

  constructor(private input: SparseMultilayerPromotionSolverInput) {
    super()
  }

  override _setup() {
    this.baseMinRectSize = Math.max(
      this.input.simpleRouteJson.minViaDiameter ?? 0,
      this.input.simpleRouteJson.minTraceWidth ?? 0,
    )
    this.nextMergedId = 0
    this.nextResidualId = 0
    this.phase = "promote"
    this.promotedNodeIds.clear()
    this.residualNodeIds.clear()
    this.workingNodes = this.input.meshNodes.map(cloneNode)
    this.outputNodes = [...this.workingNodes]
  }

  override _step() {
    if (this.phase === "promote") {
      if (
        getUsableMultilayerVolumeShare(this.workingNodes) >=
        SPARSE_PROMOTION_TARGET_SHARE
      ) {
        this.phase = "coalesce"
      } else if (!this.applyBestPromotion()) {
        this.phase = "trim"
      }
    } else if (this.phase === "trim") {
      if (
        getUsableMultilayerVolumeShare(this.workingNodes) <
        SPARSE_PROMOTION_TARGET_SHARE
      ) {
        this.workingNodes = this.removeContainedSingleLayerCoverage(
          this.workingNodes,
        )
      }
      this.phase = "coalesce"
    } else if (this.phase === "coalesce") {
      if (!this.applyBestCoalesce()) {
        this.phase = "done"
        this.solved = true
      }
    } else {
      this.solved = true
    }

    this.outputNodes = [...this.workingNodes]
  }

  /**
   * Promote one single-layer overlap into a contiguous multilayer region.
   * The solver applies at most one promotion per step so downstream tools can
   * observe the structural change as it happens.
   */
  private applyBestPromotion() {
    const candidate = this.findBestPromotionCandidate({
      minRectSize: this.baseMinRectSize,
      nodes: this.workingNodes,
    })
    if (!candidate) return false

    const sourceNode = this.workingNodes.find(
      (node) => node.capacityMeshNodeId === candidate.sourceNodeId,
    )
    const targetNode = this.workingNodes.find(
      (node) => node.capacityMeshNodeId === candidate.targetNodeId,
    )
    if (!sourceNode || !targetNode) return false

    const nextNodes = this.workingNodes.filter(
      (node) =>
        node.capacityMeshNodeId !== sourceNode.capacityMeshNodeId &&
        node.capacityMeshNodeId !== targetNode.capacityMeshNodeId,
    )

    const mergedNode = cloneNodeWithRect({
      templateNode: sourceNode,
      rect: candidate.rect,
      capacityMeshNodeId: `sparse-multilayer-merge-${this.nextMergedId++}`,
      availableZ: candidate.unionZ,
    })
    this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)

    this.workingNodes = [
      ...nextNodes,
      mergedNode,
      ...this.createResidualNodes({
        cutRect: candidate.rect,
        node: sourceNode,
        prefix: `${sourceNode.capacityMeshNodeId}-sparse-residual`,
      }),
      ...this.createResidualNodes({
        cutRect: candidate.rect,
        node: targetNode,
        prefix: `${targetNode.capacityMeshNodeId}-sparse-residual`,
      }),
    ]

    return true
  }

  /**
   * Remove single-layer space already fully represented by multilayer nodes.
   * This is a one-time cleanup pass before the coalescing phase starts.
   */
  private removeContainedSingleLayerCoverage(nodes: CapacityMeshNode[]) {
    const freeMultilayerNodes = nodes.filter(
      (node) => isFreeNode(node) && node.availableZ.length > 1,
    )
    const nextNodes: CapacityMeshNode[] = []

    for (const node of nodes) {
      if (!isFreeNode(node) || node.availableZ.length !== 1) {
        nextNodes.push(node)
        continue
      }

      const z = node.availableZ[0]!
      const coveringRects = freeMultilayerNodes
        .filter((candidate) => candidate.availableZ.includes(z))
        .map(nodeToRect)

      if (coveringRects.length === 0) {
        nextNodes.push(node)
        continue
      }

      const residuals = subtractRects(nodeToRect(node), coveringRects).filter(
        (rect) =>
          rect.width + EPS >= this.baseMinRectSize &&
          rect.height + EPS >= this.baseMinRectSize,
      )

      if (
        residuals.length === 1 &&
        rectContainsRect(residuals[0]!, nodeToRect(node)) &&
        rectContainsRect(nodeToRect(node), residuals[0]!)
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

    return nextNodes
  }

  /**
   * Coalesce one fully covered multilayer box per step.
   * This keeps the solver incremental while still collapsing gridy tiling
   * into fewer, larger shared nodes.
   */
  private applyBestCoalesce() {
    const candidate = this.findBestCoalesceCandidate(this.workingNodes)
    if (!candidate) return false

    const templateNode = this.workingNodes.find((node) =>
      candidate.absorbedNodeIds.includes(node.capacityMeshNodeId),
    )
    if (!templateNode) return false

    const survivingNodes = this.workingNodes.filter(
      (node) => !candidate.absorbedNodeIds.includes(node.capacityMeshNodeId),
    )
    const mergedNode = cloneNodeWithRect({
      templateNode,
      rect: candidate.rect,
      capacityMeshNodeId: `sparse-coalesced-${this.nextMergedId++}`,
    })
    this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)

    this.workingNodes = [...survivingNodes, mergedNode]
    return true
  }

  private createResidualNodes({
    cutRect,
    node,
    prefix,
  }: {
    cutRect: XYRect
    node: CapacityMeshNode
    prefix: string
  }) {
    return subtractRect2D(nodeToRect(node), cutRect).map((rect) => {
      const residualNode = cloneNodeWithRect({
        templateNode: node,
        rect,
        capacityMeshNodeId: `${prefix}-${this.nextResidualId++}`,
      })
      this.residualNodeIds.add(residualNode.capacityMeshNodeId)
      return residualNode
    })
  }

  private findBestCoalesceCandidate(
    nodes: CapacityMeshNode[],
  ): CoalesceCandidate | null {
    let best: CoalesceCandidate | null = null
    const nodesBySpan = new Map<
      string,
      Array<{ node: CapacityMeshNode; rect: XYRect }>
    >()

    for (const node of nodes) {
      if (!isFreeNode(node) || node.availableZ.length <= 1) continue
      const spanKey = node.availableZ.join(",")
      const entries = nodesBySpan.get(spanKey) ?? []
      entries.push({ node, rect: nodeToRect(node) })
      nodesBySpan.set(spanKey, entries)
    }

    for (const entries of nodesBySpan.values()) {
      for (let i = 0; i < entries.length; i++) {
        const a = entries[i]!

        for (let j = i + 1; j < entries.length; j++) {
          const b = entries[j]!
          if (
            !areRectsAlignedForMerge(a.rect, b.rect) &&
            !rectsTouchOrOverlap(a.rect, b.rect)
          ) {
            continue
          }

          const mergedRect = mergeRects(a.rect, b.rect)
          const absorbedEntries = entries.filter((entry) =>
            rectContainsRect(mergedRect, entry.rect),
          )
          if (absorbedEntries.length < 2) continue

          if (
            subtractRects(
              mergedRect,
              absorbedEntries.map((entry) => entry.rect),
            ).length > 0
          ) {
            continue
          }

          const score = rectArea(mergedRect) * absorbedEntries.length
          if (!best || score > best.score) {
            best = {
              rect: mergedRect,
              absorbedNodeIds: absorbedEntries.map(
                (entry) => entry.node.capacityMeshNodeId,
              ),
              score,
            }
          }
        }
      }
    }

    return best
  }

  private findBestPromotionCandidate({
    minRectSize,
    nodes,
  }: {
    minRectSize: number
    nodes: CapacityMeshNode[]
  }): PromotionCandidate | null {
    let best: PromotionCandidate | null = null

    for (let i = 0; i < nodes.length; i++) {
      const sourceNode = nodes[i]!
      if (!isFreeNode(sourceNode) || sourceNode.availableZ.length !== 1) {
        continue
      }

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue

        const targetNode = nodes[j]!
        if (!isFreeNode(targetNode)) continue

        const unionZ = getUnionZ(sourceNode.availableZ, targetNode.availableZ)
        if (unionZ.length <= targetNode.availableZ.length) continue
        if (!hasContiguousZSpan(unionZ)) continue

        const overlapRect = intersectRects(
          nodeToRect(sourceNode),
          nodeToRect(targetNode),
        )
        if (!overlapRect) continue
        if (
          overlapRect.width + EPS < minRectSize ||
          overlapRect.height + EPS < minRectSize
        ) {
          continue
        }

        const area = rectArea(overlapRect)
        if (!best || area > best.area) {
          best = {
            rect: overlapRect,
            sourceNodeId: sourceNode.capacityMeshNodeId,
            targetNodeId: targetNode.capacityMeshNodeId,
            unionZ,
            area,
          }
        }
      }
    }

    return best
  }

  override getOutput(): { outputNodes: CapacityMeshNode[] } {
    return { outputNodes: this.outputNodes }
  }

  override visualize(): GraphicsObject {
    return {
      title: "SparseMultilayerPromotionSolver",
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
          layer: `z${node.availableZ.join(",")}`,
          label: [
            `node ${node.capacityMeshNodeId}`,
            `z:${node.availableZ.join(",")}`,
          ].join("\n"),
        }
      }),
      points: [],
      lines: [],
      texts: [],
    }
  }
}
