import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { XYRect } from "../../rectdiff-types"
import type { Obstacle, SimpleRouteJson } from "../../types/srj-types"
import { obstacleToXYRect, obstacleZs } from "../RectDiffSeedingSolver/layers"
import { getColorForZLayer } from "../../utils/getColorForZLayer"
import { subtractRect2D, overlaps, EPS } from "../../utils/rectdiff-geometry"
import { padRect } from "../../utils/padRect"

type OuterLayerContainmentMergeSolverInput = {
  meshNodes: CapacityMeshNode[]
  simpleRouteJson: SimpleRouteJson
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}

type ObstacleWithRect = {
  obstacle: Obstacle
  rect: XYRect
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

const isSingletonOuterNode = (node: CapacityMeshNode, outerZ: number) =>
  node.availableZ.length === 1 && node.availableZ[0] === outerZ

const sameRect = (a: XYRect, b: XYRect) =>
  Math.abs(a.x - b.x) <= EPS &&
  Math.abs(a.y - b.y) <= EPS &&
  Math.abs(a.width - b.width) <= EPS &&
  Math.abs(a.height - b.height) <= EPS

const subtractRects = (target: XYRect, cutters: XYRect[]) => {
  let remaining: XYRect[] = [target]

  for (const cutter of cutters) {
    if (remaining.length === 0) return remaining

    const nextRemaining: XYRect[] = []
    for (const piece of remaining) {
      nextRemaining.push(...subtractRect2D(piece, cutter))
    }
    remaining = nextRemaining
  }

  return remaining
}

const isFullyCoveredByRects = (target: XYRect, coveringRects: XYRect[]) => {
  return subtractRects(target, coveringRects).length === 0
}

export class OuterLayerContainmentMergeSolver extends BaseSolver {
  private outputNodes: CapacityMeshNode[] = []
  private promotedNodeIds = new Set<string>()
  private residualNodeIds = new Set<string>()

  constructor(private input: OuterLayerContainmentMergeSolverInput) {
    super()
  }

  override _setup() {
    this.outputNodes = this.input.meshNodes.map(cloneNode)
    this.promotedNodeIds.clear()
    this.residualNodeIds.clear()
  }

  override _step() {
    this.outputNodes = this.processOuterLayerContainmentMerges()
    this.solved = true
  }

  private processOuterLayerContainmentMerges(): CapacityMeshNode[] {
    const srj = this.input.simpleRouteJson
    const layerCount = Math.max(1, srj.layerCount || 1)
    if (layerCount < 3) {
      return this.input.meshNodes.map(cloneNode)
    }

    const topZ = 0
    const bottomZ = layerCount - 1
    const viaMinSize = Math.max(srj.minViaDiameter ?? 0, srj.minTraceWidth || 0)
    const originalNodes = this.input.meshNodes.map(cloneNode)
    const obstaclesByLayer = this.buildObstaclesByLayer(layerCount)
    if (
      !obstaclesByLayer
        .slice(1, -1)
        .some((entries) => entries.some((entry) => entry.obstacle.isCopperPour))
    ) {
      return originalNodes
    }
    const mutableOuterNodes = originalNodes.filter(
      (node) =>
        isFreeNode(node) &&
        (isSingletonOuterNode(node, topZ) ||
          isSingletonOuterNode(node, bottomZ)),
    )
    const immutableNodes = originalNodes.filter((node) => !isFreeNode(node))
    // Target and obstacle footprints can overlap free support in pipeline
    // input. They stay unchanged, so promotions must not consume their space.
    const immutableOuterRects = immutableNodes
      .filter(
        (node) =>
          node.availableZ.includes(topZ) || node.availableZ.includes(bottomZ),
      )
      .map(nodeToRect)
    const freeSupportNodesByOuterLayer = new Map<number, CapacityMeshNode[]>()
    freeSupportNodesByOuterLayer.set(
      topZ,
      originalNodes.filter(
        (node) => isFreeNode(node) && node.availableZ.includes(topZ),
      ),
    )
    freeSupportNodesByOuterLayer.set(
      bottomZ,
      originalNodes.filter(
        (node) => isFreeNode(node) && node.availableZ.includes(bottomZ),
      ),
    )

    const promotedNodes: CapacityMeshNode[] = []
    const promotedRects: XYRect[] = []
    const candidateNodes = mutableOuterNodes
      .filter(
        (node) =>
          node.width + EPS >= viaMinSize && node.height + EPS >= viaMinSize,
      )
      .sort((a, b) => rectArea(nodeToRect(b)) - rectArea(nodeToRect(a)))

    for (const candidate of candidateNodes) {
      const candidateZ = candidate.availableZ[0]!
      const oppositeZ = candidateZ === topZ ? bottomZ : topZ
      const candidateRect = nodeToRect(candidate)
      if (immutableOuterRects.some((rect) => overlaps(rect, candidateRect))) {
        continue
      }
      const oppositeSupportNodes = (
        freeSupportNodesByOuterLayer.get(oppositeZ) ?? []
      ).filter((node) => overlaps(candidateRect, nodeToRect(node)))
      const supportZs = oppositeSupportNodes[0]?.availableZ
      if (!supportZs) continue

      if (promotedRects.some((rect) => overlaps(candidateRect, rect))) {
        continue
      }

      if (
        !this.isTransitCompatibleAcrossIntermediateLayers({
          rect: candidateRect,
          fromZ: candidateZ,
          toZ: oppositeZ,
          obstaclesByLayer,
        })
      ) {
        continue
      }
      if (
        !isFullyCoveredByRects(
          candidateRect,
          oppositeSupportNodes.map(nodeToRect),
        )
      ) {
        continue
      }

      // Keep a large region when the supporting layers are uniform. Otherwise
      // split at support boundaries so no inner-layer access is lost or added.
      const hasUniformSupport = oppositeSupportNodes.every(
        (node) =>
          node.availableZ.length === supportZs.length &&
          node.availableZ.every((z) => supportZs.includes(z)),
      )
      const pieces = hasUniformSupport
        ? [{ rect: candidateRect, availableZ: supportZs }]
        : oppositeSupportNodes.map((node) => {
            const supportRect = nodeToRect(node)
            const x = Math.max(candidateRect.x, supportRect.x)
            const y = Math.max(candidateRect.y, supportRect.y)
            return {
              rect: {
                x,
                y,
                width:
                  Math.min(
                    candidateRect.x + candidateRect.width,
                    supportRect.x + supportRect.width,
                  ) - x,
                height:
                  Math.min(
                    candidateRect.y + candidateRect.height,
                    supportRect.y + supportRect.height,
                  ) - y,
              },
              availableZ: node.availableZ,
            }
          })
      for (const [index, piece] of pieces.entries()) {
        if (
          piece.rect.width + EPS < viaMinSize ||
          piece.rect.height + EPS < viaMinSize
        ) {
          continue
        }
        const availableZ = [...new Set([candidateZ, ...piece.availableZ])].sort(
          (a, b) => a - b,
        )
        const nodeId =
          index === 0
            ? candidate.capacityMeshNodeId
            : `${candidate.capacityMeshNodeId}-outer-support-${index}`
        promotedNodes.push(
          cloneNodeWithRect({ ...candidate, availableZ }, piece.rect, nodeId),
        )
        promotedRects.push(piece.rect)
        this.promotedNodeIds.add(nodeId)
      }
    }

    if (promotedNodes.length === 0) return originalNodes

    let nextResidualId = 0
    const residualNodes: CapacityMeshNode[] = []

    for (const node of originalNodes.filter(isFreeNode)) {
      const nodeRect = nodeToRect(node)
      const outerZs = node.availableZ.filter((z) => z === topZ || z === bottomZ)
      if (outerZs.length === 0) {
        residualNodes.push(node)
        continue
      }
      const remainingPieces = subtractRects(nodeRect, promotedRects)

      if (
        remainingPieces.length === 1 &&
        sameRect(remainingPieces[0]!, nodeRect)
      ) {
        residualNodes.push(node)
        continue
      }

      for (const piece of remainingPieces) {
        const residualNode = cloneNodeWithRect(
          node,
          piece,
          `${node.capacityMeshNodeId}-outer-merge-${nextResidualId++}`,
        )
        residualNodes.push(residualNode)
        this.residualNodeIds.add(residualNode.capacityMeshNodeId)
      }
    }

    return [...immutableNodes, ...promotedNodes, ...residualNodes]
  }

  private buildObstaclesByLayer(layerCount: number): ObstacleWithRect[][] {
    const out = Array.from(
      { length: layerCount },
      () => [] as ObstacleWithRect[],
    )

    for (const obstacle of this.input.simpleRouteJson.obstacles ?? []) {
      const baseRect = obstacleToXYRect(obstacle)
      if (!baseRect) continue
      const rect = padRect(baseRect, this.input.obstacleClearance ?? 0)
      const zLayers = obstacleZs(obstacle, this.input.zIndexByName)

      for (const z of zLayers) {
        if (z < 0 || z >= layerCount) continue
        out[z]!.push({ obstacle, rect })
      }
    }

    return out
  }

  private isTransitCompatibleAcrossIntermediateLayers(params: {
    rect: XYRect
    fromZ: number
    toZ: number
    obstaclesByLayer: ObstacleWithRect[][]
  }) {
    const { rect, fromZ, toZ, obstaclesByLayer } = params
    const lo = Math.min(fromZ, toZ)
    const hi = Math.max(fromZ, toZ)

    if (hi - lo < 2) return false

    // This merge reconnects outer regions separated by copper planes. Empty
    // inner layers permit transit, but do not require a containment merge.
    let crossesCopperPlane = false
    for (let z = lo + 1; z < hi; z++) {
      const overlapping = (obstaclesByLayer[z] ?? []).filter((entry) =>
        overlaps(entry.rect, rect),
      )
      if (overlapping.length === 0) continue
      const nonCopperOverlap = overlapping.some(
        (entry) => !entry.obstacle.isCopperPour,
      )
      if (nonCopperOverlap) return false
      if (
        !isFullyCoveredByRects(
          rect,
          overlapping.map((entry) => entry.rect),
        )
      ) {
        return false
      }
      crossesCopperPlane = true
    }

    return crossesCopperPlane
  }

  override getOutput(): { outputNodes: CapacityMeshNode[] } {
    return { outputNodes: this.outputNodes }
  }

  override visualize(): GraphicsObject {
    return {
      title: "OuterLayerContainmentMergeSolver",
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
            ? "rgba(22, 163, 74, 0.95)"
            : isResidual
              ? "rgba(37, 99, 235, 0.95)"
              : colors.stroke,
          fill: node._containsObstacle
            ? "rgba(239, 68, 68, 0.35)"
            : isPromoted
              ? "rgba(34, 197, 94, 0.28)"
              : isResidual
                ? "rgba(59, 130, 246, 0.18)"
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
