import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { XYRect } from "../../rectdiff-types"
import type { SimpleRouteJson } from "../../types/srj-types"
import { EPS, subtractRect2D } from "../../utils/rectdiff-geometry"
import { getColorForZLayer } from "../../utils/getColorForZLayer"

type SparseMultilayerPromotionSolverInput = {
  meshNodes: CapacityMeshNode[]
  simpleRouteJson: SimpleRouteJson
}

type MergeCandidate = {
  sourceNodeId: string
  targetNodeId: string
  rect: XYRect
  unionZ: number[]
  area: number
}

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

const cloneNodeWithRect = (
  node: CapacityMeshNode,
  rect: XYRect,
  capacityMeshNodeId: string,
): CapacityMeshNode => ({
  ...node,
  capacityMeshNodeId,
  center: {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  },
  width: rect.width,
  height: rect.height,
  availableZ: [...node.availableZ],
  layer: `z${node.availableZ.join(",")}`,
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

const mergeRects = (a: XYRect, b: XYRect): XYRect => {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
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
    if (node.availableZ.length > 1) multilayerVolume += volume
  }

  const usableVolume = totalVolume - obstacleVolume
  if (usableVolume <= EPS) return 0
  return multilayerVolume / usableVolume
}

const getUnionZ = (a: number[], b: number[]) =>
  [...new Set([...a, ...b])].sort((x, y) => x - y)

const hasContiguousZSpan = (zValues: number[]) => {
  for (let i = 1; i < zValues.length; i++) {
    if (zValues[i]! - zValues[i - 1]! !== 1) return false
  }
  return true
}

const rectContainsRect = (outer: XYRect, inner: XYRect) =>
  inner.x + EPS >= outer.x &&
  inner.y + EPS >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width + EPS &&
  inner.y + inner.height <= outer.y + outer.height + EPS

const rectsTouchOrOverlap = (a: XYRect, b: XYRect) =>
  a.x <= b.x + b.width + EPS &&
  b.x <= a.x + a.width + EPS &&
  a.y <= b.y + b.height + EPS &&
  b.y <= a.y + a.height + EPS

const subtractRects = (target: XYRect, cutters: XYRect[]) => {
  let remaining: XYRect[] = [target]

  for (const cutter of cutters) {
    if (remaining.length === 0) return remaining
    remaining = remaining.flatMap((piece) => subtractRect2D(piece, cutter))
  }

  return remaining
}

const SPARSE_PROMOTION_TARGET_SHARE = 0.86

type CoalesceCandidate = {
  rect: XYRect
  absorbedNodeIds: string[]
  score: number
}

export class SparseMultilayerPromotionSolver extends BaseSolver {
  private outputNodes: CapacityMeshNode[] = []
  private promotedNodeIds = new Set<string>()
  private residualNodeIds = new Set<string>()

  constructor(private input: SparseMultilayerPromotionSolverInput) {
    super()
  }

  override _setup() {
    this.outputNodes = this.input.meshNodes.map(cloneNode)
    this.promotedNodeIds.clear()
    this.residualNodeIds.clear()
  }

  override _step() {
    this.outputNodes = this.promoteSparseMultilayerCoverage()
    this.solved = true
  }

  private promoteSparseMultilayerCoverage() {
    const baseMinRectSize = Math.max(
      this.input.simpleRouteJson.minViaDiameter ?? 0,
      this.input.simpleRouteJson.minTraceWidth ?? 0,
    )
    const threshold = SPARSE_PROMOTION_TARGET_SHARE
    let nodes = this.input.meshNodes.map(cloneNode)

    if (getUsableMultilayerVolumeShare(nodes) >= threshold) {
      return nodes
    }

    let nextResidualId = 0
    let nextMergedId = 0
    let iterations = 0

    while (
      getUsableMultilayerVolumeShare(nodes) < threshold &&
      iterations < 1000
    ) {
      const mergeCandidate = this.findBestMergeCandidate(nodes, baseMinRectSize)
      if (!mergeCandidate) break

      const sourceNode = nodes.find(
        (node) => node.capacityMeshNodeId === mergeCandidate.sourceNodeId,
      )
      const targetNode = nodes.find(
        (node) => node.capacityMeshNodeId === mergeCandidate.targetNodeId,
      )
      if (!sourceNode || !targetNode) break

      const remainingNodes = nodes.filter(
        (node) =>
          node.capacityMeshNodeId !== sourceNode.capacityMeshNodeId &&
          node.capacityMeshNodeId !== targetNode.capacityMeshNodeId,
      )

      const mergedNode = cloneNodeWithRect(
        sourceNode,
        mergeCandidate.rect,
        `sparse-multilayer-merge-${nextMergedId++}`,
      )
      mergedNode.availableZ = mergeCandidate.unionZ
      mergedNode.layer = `z${mergeCandidate.unionZ.join(",")}`
      this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)

      const sourceResiduals = subtractRect2D(
        nodeToRect(sourceNode),
        mergeCandidate.rect,
      ).map((piece) => {
        const residual = cloneNodeWithRect(
          sourceNode,
          piece,
          `${sourceNode.capacityMeshNodeId}-sparse-residual-${nextResidualId++}`,
        )
        this.residualNodeIds.add(residual.capacityMeshNodeId)
        return residual
      })

      const targetResiduals = subtractRect2D(
        nodeToRect(targetNode),
        mergeCandidate.rect,
      ).map((piece) => {
        const residual = cloneNodeWithRect(
          targetNode,
          piece,
          `${targetNode.capacityMeshNodeId}-sparse-residual-${nextResidualId++}`,
        )
        this.residualNodeIds.add(residual.capacityMeshNodeId)
        return residual
      })

      nodes = [
        ...remainingNodes,
        mergedNode,
        ...sourceResiduals,
        ...targetResiduals,
      ]
      iterations++
    }

    if (getUsableMultilayerVolumeShare(nodes) < threshold) {
      nodes = this.removeSingleLayerCoverageAlreadyContainedInMultilayerNodes(
        nodes,
        baseMinRectSize,
      )
    }

    return this.coalesceCompatibleNodes(nodes)
  }

  private removeSingleLayerCoverageAlreadyContainedInMultilayerNodes(
    nodes: CapacityMeshNode[],
    minRectSize: number,
  ) {
    let nextResidualId = 0
    const nextNodes: CapacityMeshNode[] = []
    const freeMultilayerNodes = nodes.filter(
      (node) => isFreeNode(node) && node.availableZ.length > 1,
    )

    for (const node of nodes) {
      if (!isFreeNode(node) || node.availableZ.length !== 1) {
        nextNodes.push(node)
        continue
      }

      const z = node.availableZ[0]!
      const cutters = freeMultilayerNodes
        .filter((candidate) => candidate.availableZ.includes(z))
        .map(nodeToRect)

      if (cutters.length === 0) {
        nextNodes.push(node)
        continue
      }

      let residuals = [nodeToRect(node)]
      for (const cutter of cutters) {
        residuals = residuals.flatMap((piece) => subtractRect2D(piece, cutter))
        if (residuals.length === 0) break
      }

      if (residuals.length === 1) {
        const onlyResidual = residuals[0]!
        if (
          Math.abs(onlyResidual.width - node.width) <= EPS &&
          Math.abs(onlyResidual.height - node.height) <= EPS &&
          Math.abs(onlyResidual.x - (node.center.x - node.width / 2)) <= EPS &&
          Math.abs(onlyResidual.y - (node.center.y - node.height / 2)) <= EPS
        ) {
          nextNodes.push(node)
          continue
        }
      }

      for (const piece of residuals) {
        if (
          piece.width + EPS < minRectSize ||
          piece.height + EPS < minRectSize
        ) {
          continue
        }
        const residual = cloneNodeWithRect(
          node,
          piece,
          `${node.capacityMeshNodeId}-contained-residual-${nextResidualId++}`,
        )
        this.residualNodeIds.add(residual.capacityMeshNodeId)
        nextNodes.push(residual)
      }
    }

    return nextNodes
  }

  private coalesceCompatibleNodes(nodes: CapacityMeshNode[]) {
    const out = [...nodes]
    let nextMergedId = 0

    while (true) {
      const bestCandidate = this.findBestCoalesceCandidate(out)
      if (!bestCandidate) break

      const survivingNodes = out.filter(
        (node) =>
          !bestCandidate.absorbedNodeIds.includes(node.capacityMeshNodeId),
      )
      const templateNode = out.find(
        (node) => node.capacityMeshNodeId === bestCandidate.absorbedNodeIds[0],
      )
      if (!templateNode) break

      const mergedNode = cloneNodeWithRect(
        templateNode,
        bestCandidate.rect,
        `sparse-coalesced-${nextMergedId++}`,
      )
      this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)
      out.splice(0, out.length, ...survivingNodes, mergedNode)
    }

    return out
  }

  private findBestCoalesceCandidate(
    nodes: CapacityMeshNode[],
  ): CoalesceCandidate | null {
    const nodesBySpan = new Map<string, CapacityMeshNode[]>()

    for (const node of nodes) {
      if (!isFreeNode(node) || node.availableZ.length <= 1) continue
      const spanKey = node.availableZ.join(",")
      const group = nodesBySpan.get(spanKey) ?? []
      group.push(node)
      nodesBySpan.set(spanKey, group)
    }

    let best: CoalesceCandidate | null = null

    for (const [spanKey, spanNodes] of nodesBySpan) {
      for (let i = 0; i < spanNodes.length; i++) {
        const a = spanNodes[i]!
        const rectA = nodeToRect(a)

        for (let j = i + 1; j < spanNodes.length; j++) {
          const b = spanNodes[j]!
          const rectB = nodeToRect(b)

          if (
            !areRectsAlignedForMerge(rectA, rectB) &&
            !rectsTouchOrOverlap(rectA, rectB)
          ) {
            continue
          }

          const mergedRect = mergeRects(rectA, rectB)
          const absorbedNodes = spanNodes.filter((node) =>
            rectContainsRect(mergedRect, nodeToRect(node)),
          )
          if (absorbedNodes.length < 2) continue

          const uncovered = subtractRects(
            mergedRect,
            absorbedNodes.map(nodeToRect),
          )
          if (uncovered.length > 0) continue

          const mergedArea = rectArea(mergedRect)
          const score = mergedArea * absorbedNodes.length

          if (!best || score > best.score) {
            best = {
              rect: mergedRect,
              absorbedNodeIds: absorbedNodes.map(
                (node) => node.capacityMeshNodeId,
              ),
              score,
            }
          }
        }
      }
    }

    return best
  }

  private findBestMergeCandidate(
    nodes: CapacityMeshNode[],
    minRectSize: number,
  ): MergeCandidate | null {
    let best: MergeCandidate | null = null

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
            sourceNodeId: sourceNode.capacityMeshNodeId,
            targetNodeId: targetNode.capacityMeshNodeId,
            rect: overlapRect,
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
