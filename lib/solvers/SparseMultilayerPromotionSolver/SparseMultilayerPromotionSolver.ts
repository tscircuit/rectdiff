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
    const minRectSize = Math.max(
      this.input.simpleRouteJson.minViaDiameter ?? 0,
      this.input.simpleRouteJson.minTraceWidth ?? 0,
    )
    const threshold = 0.9
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
      const mergeCandidate = this.findBestMergeCandidate(nodes, minRectSize)
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
        minRectSize,
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
    let merged = true
    let nextMergedId = 0

    while (merged) {
      merged = false

      for (let i = 0; i < out.length; i++) {
        const a = out[i]!
        if (!isFreeNode(a)) continue

        for (let j = i + 1; j < out.length; j++) {
          const b = out[j]!
          if (!isFreeNode(b)) continue
          if (a.availableZ.join(",") !== b.availableZ.join(",")) continue

          const rectA = nodeToRect(a)
          const rectB = nodeToRect(b)
          if (!areRectsAlignedForMerge(rectA, rectB)) continue

          const mergedRect = mergeRects(rectA, rectB)
          const mergedNode = cloneNodeWithRect(
            a,
            mergedRect,
            `sparse-coalesced-${nextMergedId++}`,
          )

          out.splice(j, 1)
          out.splice(i, 1, mergedNode)
          this.promotedNodeIds.add(mergedNode.capacityMeshNodeId)
          merged = true
          break
        }

        if (merged) break
      }
    }

    return out
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
