import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { XYRect } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { SimpleRouteJson } from "../../types/srj-types"
import { getColorForZLayer } from "../../utils/getColorForZLayer"
import { EPS, overlaps, subtractRect2D } from "../../utils/rectdiff-geometry"

type AdjacentLayerContainmentMergeSolverInput = {
  meshNodes: CapacityMeshNode[]
  simpleRouteJson: SimpleRouteJson
  minFragmentArea?: number
}

const DEFAULT_MIN_FRAGMENT_AREA = 0.2 ** 2

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

const clonePromotedNodeWithRect = (
  node: CapacityMeshNode,
  rect: XYRect,
  capacityMeshNodeId: string,
  availableZ: number[],
): CapacityMeshNode => ({
  ...node,
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

const isSingletonNodeOnLayer = (node: CapacityMeshNode, z: number) =>
  node.availableZ.length === 1 && node.availableZ[0] === z

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

const sortAndDedupeCuts = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []

  for (const value of sorted) {
    const last = out[out.length - 1]
    if (last == null || Math.abs(last - value) > EPS) {
      out.push(value)
    }
  }

  return out
}

const partitionRectByRects = (target: XYRect, supportRects: XYRect[]) => {
  const xCuts = [target.x, target.x + target.width]
  const yCuts = [target.y, target.y + target.height]
  const targetMaxX = target.x + target.width
  const targetMaxY = target.y + target.height

  for (const rect of supportRects) {
    const x0 = Math.max(target.x, rect.x)
    const x1 = Math.min(targetMaxX, rect.x + rect.width)
    const y0 = Math.max(target.y, rect.y)
    const y1 = Math.min(targetMaxY, rect.y + rect.height)

    if (x1 <= x0 + EPS || y1 <= y0 + EPS) continue

    xCuts.push(x0, x1)
    yCuts.push(y0, y1)
  }

  const xs = sortAndDedupeCuts(xCuts)
  const ys = sortAndDedupeCuts(yCuts)
  const cells: XYRect[] = []

  for (let xi = 0; xi < xs.length - 1; xi++) {
    const x0 = xs[xi]!
    const x1 = xs[xi + 1]!

    if (x1 <= x0 + EPS) continue

    for (let yi = 0; yi < ys.length - 1; yi++) {
      const y0 = ys[yi]!
      const y1 = ys[yi + 1]!

      if (y1 <= y0 + EPS) continue

      cells.push({
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
      })
    }
  }

  return cells
}

const canMergeHorizontally = (a: XYRect, b: XYRect) =>
  Math.abs(a.y - b.y) <= EPS &&
  Math.abs(a.height - b.height) <= EPS &&
  Math.abs(a.x + a.width - b.x) <= EPS

const canMergeVertically = (a: XYRect, b: XYRect) =>
  Math.abs(a.x - b.x) <= EPS &&
  Math.abs(a.width - b.width) <= EPS &&
  Math.abs(a.y + a.height - b.y) <= EPS

const mergeTouchingRects = (rects: XYRect[]) => {
  const out = rects.map((rect) => ({ ...rect }))
  let changed = true

  while (changed) {
    changed = false

    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!
        const b = out[j]!

        if (canMergeHorizontally(a, b) || canMergeHorizontally(b, a)) {
          const merged: XYRect = {
            x: Math.min(a.x, b.x),
            y: a.y,
            width: a.width + b.width,
            height: a.height,
          }
          out.splice(j, 1)
          out.splice(i, 1, merged)
          changed = true
          break outer
        }

        if (canMergeVertically(a, b) || canMergeVertically(b, a)) {
          const merged: XYRect = {
            x: a.x,
            y: Math.min(a.y, b.y),
            width: a.width,
            height: a.height + b.height,
          }
          out.splice(j, 1)
          out.splice(i, 1, merged)
          changed = true
          break outer
        }
      }
    }
  }

  return out
}

const isPromotableRect = (params: {
  rect: XYRect
  viaMinSize: number
  minFragmentArea: number
}) => {
  const { rect, viaMinSize, minFragmentArea } = params

  return (
    rect.width > EPS &&
    rect.height > EPS &&
    rectArea(rect) + EPS >= minFragmentArea &&
    rect.width + EPS >= viaMinSize &&
    rect.height + EPS >= viaMinSize
  )
}

const isResidualRect = (rect: XYRect, minFragmentArea: number) =>
  rect.width > EPS &&
  rect.height > EPS &&
  rectArea(rect) + EPS >= minFragmentArea

const computePromotablePieces = (params: {
  target: XYRect
  supportRects: XYRect[]
  viaMinSize: number
  minFragmentArea: number
}) => {
  const { target, supportRects, viaMinSize, minFragmentArea } = params
  const overlappingSupports = supportRects.filter((rect) =>
    overlaps(rect, target),
  )

  if (overlappingSupports.length === 0) return []

  if (
    isFullyCoveredByRects(target, overlappingSupports) &&
    isPromotableRect({ rect: target, viaMinSize, minFragmentArea })
  ) {
    return [target]
  }

  const partitioned = partitionRectByRects(target, overlappingSupports)
  const coveredPieces = partitioned.filter((piece) =>
    isFullyCoveredByRects(piece, overlappingSupports),
  )

  if (coveredPieces.length === 0) return []

  const mergedCoveredPieces = mergeTouchingRects(coveredPieces)

  return mergedCoveredPieces.filter(
    (piece) =>
      isFullyCoveredByRects(piece, overlappingSupports) &&
      isPromotableRect({ rect: piece, viaMinSize, minFragmentArea }),
  )
}

export class AdjacentLayerContainmentMergeSolver extends BaseSolver {
  private outputNodes: CapacityMeshNode[] = []
  private promotedNodeIds = new Set<string>()
  private residualNodeIds = new Set<string>()

  constructor(private input: AdjacentLayerContainmentMergeSolverInput) {
    super()
  }

  override _setup() {
    this.outputNodes = this.input.meshNodes.map(cloneNode)
    this.promotedNodeIds.clear()
    this.residualNodeIds.clear()
  }

  override _step() {
    this.outputNodes = this.processAdjacentLayerContainmentMerges()
    this.solved = true
  }

  private processAdjacentLayerContainmentMerges(): CapacityMeshNode[] {
    const srj = this.input.simpleRouteJson
    const layerCount = Math.max(1, srj.layerCount || 1)

    if (layerCount < 2) {
      return this.input.meshNodes.map(cloneNode)
    }

    const viaMinSize = Math.max(srj.minViaDiameter ?? 0, srj.minTraceWidth || 0)
    const minFragmentArea = Math.max(
      EPS,
      this.input.minFragmentArea ?? DEFAULT_MIN_FRAGMENT_AREA,
    )

    let workingNodes = this.input.meshNodes.map(cloneNode)
    let nextResidualId = 0
    let nextPromotedId = 0

    for (let lowerZ = 0; lowerZ < layerCount - 1; lowerZ++) {
      const upperZ = lowerZ + 1
      const mutableNodes = workingNodes.filter(
        (node) =>
          isFreeNode(node) &&
          (isSingletonNodeOnLayer(node, lowerZ) ||
            isSingletonNodeOnLayer(node, upperZ)),
      )

      if (mutableNodes.length === 0) continue

      const immutableNodes = workingNodes.filter(
        (node) => !mutableNodes.includes(node),
      )
      const supportRectsByLayer = new Map<number, XYRect[]>()

      supportRectsByLayer.set(
        lowerZ,
        mutableNodes
          .filter((node) => isSingletonNodeOnLayer(node, lowerZ))
          .map(nodeToRect),
      )
      supportRectsByLayer.set(
        upperZ,
        mutableNodes
          .filter((node) => isSingletonNodeOnLayer(node, upperZ))
          .map(nodeToRect),
      )

      const promotedRects: XYRect[] = []
      const promotedNodes: CapacityMeshNode[] = []
      const candidateNodes = mutableNodes
        .filter((node) =>
          isPromotableRect({
            rect: nodeToRect(node),
            viaMinSize,
            minFragmentArea,
          }),
        )
        .sort((a, b) => rectArea(nodeToRect(b)) - rectArea(nodeToRect(a)))

      for (const candidate of candidateNodes) {
        const candidateRect = nodeToRect(candidate)
        const candidatePieces = subtractRects(
          candidateRect,
          promotedRects,
        ).filter((piece) => isResidualRect(piece, minFragmentArea))
        const candidateZ = candidate.availableZ[0]!
        const oppositeZ = candidateZ === lowerZ ? upperZ : lowerZ
        const supportRects = supportRectsByLayer.get(oppositeZ) ?? []

        for (const piece of candidatePieces) {
          const promotablePieces = computePromotablePieces({
            target: piece,
            supportRects,
            viaMinSize,
            minFragmentArea,
          })

          for (const promotablePiece of promotablePieces) {
            promotedRects.push(promotablePiece)

            const promotedNode = clonePromotedNodeWithRect(
              candidate,
              promotablePiece,
              `${candidate.capacityMeshNodeId}-adjacent-merge-${nextPromotedId++}`,
              [lowerZ, upperZ],
            )
            promotedNodes.push(promotedNode)
            this.promotedNodeIds.add(promotedNode.capacityMeshNodeId)
          }
        }
      }

      const residualNodes: CapacityMeshNode[] = []

      for (const node of mutableNodes) {
        const nodeRect = nodeToRect(node)
        const remainingPieces = subtractRects(nodeRect, promotedRects).filter(
          (piece) => isResidualRect(piece, minFragmentArea),
        )

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
            `${node.capacityMeshNodeId}-adjacent-residual-${nextResidualId++}`,
          )
          residualNodes.push(residualNode)
          this.residualNodeIds.add(residualNode.capacityMeshNodeId)
        }
      }

      workingNodes = [...immutableNodes, ...promotedNodes, ...residualNodes]
    }

    return workingNodes
  }

  override getOutput(): { outputNodes: CapacityMeshNode[] } {
    return { outputNodes: this.outputNodes }
  }

  override visualize(): GraphicsObject {
    return {
      title: "AdjacentLayerContainmentMergeSolver",
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
            ? "rgba(245, 158, 11, 0.95)"
            : isResidual
              ? "rgba(37, 99, 235, 0.95)"
              : colors.stroke,
          fill: node._containsObstacle
            ? "rgba(239, 68, 68, 0.35)"
            : isPromoted
              ? "rgba(251, 191, 36, 0.28)"
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
