import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../types/srj-types"
import type { Placed3D, XYRect } from "./rectdiff/types"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"
import { FlatbushIndex } from "../data-structures/FlatbushIndex"

export interface RectEdge {
  rect: XYRect
  side: "top" | "bottom" | "left" | "right"
  x1: number
  y1: number
  x2: number
  y2: number
  normal: { x: number; y: number }
  zLayers: number[]
}

export interface ExpansionPoint {
  x: number
  y: number
  zLayers: number[]
  edge: RectEdge
}

export interface GapFillSolverInput {
  simpleRouteJson: SimpleRouteJson
  placedRects: Placed3D[]
  obstaclesByLayer: XYRect[][]
  maxEdgeDistance?: number
}

type SubPhase =
  | "SELECT_PRIMARY_EDGE"
  | "FIND_NEARBY_EDGES"
  | "CHECK_UNOCCUPIED"
  | "PLACE_EXPANSION_POINTS"
  | "EXPAND_POINT"
  | "DONE"

interface GapFillState {
  srj: SimpleRouteJson
  inputRects: Placed3D[]
  obstaclesByLayer: XYRect[][]
  layerCount: number
  maxEdgeDistance: number
  minTraceWidth: number

  edges: RectEdge[]
  edgeSpatialIndex: FlatbushIndex<RectEdge>

  phase: SubPhase
  currentEdgeIndex: number
  currentPrimaryEdge?: RectEdge

  nearbyEdgeCandidateIndex: number
  currentNearbyEdges: RectEdge[]

  currentExpansionPoints: ExpansionPoint[]
  currentExpansionIndex: number

  filledRects: Placed3D[]
}

/**
 * Gap Fill Solver - fills gaps between existing rectangles using edge analysis.
 * Processes one edge per step for visualization.
 */
export class GapFillSolver extends BaseSolver {
  private state!: GapFillState

  constructor(input: GapFillSolverInput) {
    super()
    this.state = this.initState(input)
  }

  private initState(input: GapFillSolverInput): GapFillState {
    const layerCount = input.simpleRouteJson.layerCount || 1
    const maxEdgeDistance = input.maxEdgeDistance ?? 2.0

    const rawEdges = this.extractEdges(
      input.placedRects,
      input.obstaclesByLayer,
    )
    const edges = this.splitEdgesOnOverlaps(rawEdges)

    const edgeSpatialIndex = this.buildEdgeSpatialIndex(edges, maxEdgeDistance)

    return {
      srj: input.simpleRouteJson,
      inputRects: input.placedRects,
      obstaclesByLayer: input.obstaclesByLayer,
      layerCount,
      maxEdgeDistance,
      minTraceWidth: input.simpleRouteJson.minTraceWidth,
      edges,
      edgeSpatialIndex,
      phase: "SELECT_PRIMARY_EDGE",
      currentEdgeIndex: 0,
      nearbyEdgeCandidateIndex: 0,
      currentNearbyEdges: [],
      currentExpansionPoints: [],
      currentExpansionIndex: 0,
      filledRects: [],
    }
  }

  private buildEdgeSpatialIndex(
    edges: RectEdge[],
    maxEdgeDistance: number,
  ): FlatbushIndex<RectEdge> {
    const index = new FlatbushIndex<RectEdge>(edges.length)

    for (const edge of edges) {
      const minX = Math.min(edge.x1, edge.x2) - maxEdgeDistance
      const minY = Math.min(edge.y1, edge.y2) - maxEdgeDistance
      const maxX = Math.max(edge.x1, edge.x2) + maxEdgeDistance
      const maxY = Math.max(edge.y1, edge.y2) + maxEdgeDistance

      index.insert(edge, minX, minY, maxX, maxY)
    }

    index.finish()
    return index
  }

  private extractEdges(
    rects: Placed3D[],
    obstaclesByLayer: XYRect[][],
  ): RectEdge[] {
    const edges: RectEdge[] = []

    for (const placed of rects) {
      const { rect, zLayers } = placed

      edges.push({
        rect,
        side: "top",
        x1: rect.x,
        y1: rect.y + rect.height,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        normal: { x: 0, y: 1 },
        zLayers: [...zLayers],
      })

      edges.push({
        rect,
        side: "bottom",
        x1: rect.x,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y,
        normal: { x: 0, y: -1 },
        zLayers: [...zLayers],
      })

      edges.push({
        rect,
        side: "right",
        x1: rect.x + rect.width,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        normal: { x: 1, y: 0 },
        zLayers: [...zLayers],
      })

      edges.push({
        rect,
        side: "left",
        x1: rect.x,
        y1: rect.y,
        x2: rect.x,
        y2: rect.y + rect.height,
        normal: { x: -1, y: 0 },
        zLayers: [...zLayers],
      })
    }

    for (let z = 0; z < obstaclesByLayer.length; z++) {
      const obstacles = obstaclesByLayer[z] ?? []
      for (const rect of obstacles) {
        const zLayers = [z]

        edges.push({
          rect,
          side: "top",
          x1: rect.x,
          y1: rect.y + rect.height,
          x2: rect.x + rect.width,
          y2: rect.y + rect.height,
          normal: { x: 0, y: 1 },
          zLayers,
        })

        edges.push({
          rect,
          side: "bottom",
          x1: rect.x,
          y1: rect.y,
          x2: rect.x + rect.width,
          y2: rect.y,
          normal: { x: 0, y: -1 },
          zLayers,
        })

        edges.push({
          rect,
          side: "right",
          x1: rect.x + rect.width,
          y1: rect.y,
          x2: rect.x + rect.width,
          y2: rect.y + rect.height,
          normal: { x: 1, y: 0 },
          zLayers,
        })

        edges.push({
          rect,
          side: "left",
          x1: rect.x,
          y1: rect.y,
          x2: rect.x,
          y2: rect.y + rect.height,
          normal: { x: -1, y: 0 },
          zLayers,
        })
      }
    }

    return edges
  }

  private splitEdgesOnOverlaps(edges: RectEdge[]): RectEdge[] {
    const result: RectEdge[] = []
    const tolerance = 0.01

    for (const edge of edges) {
      const isHorizontal = Math.abs(edge.normal.y) > 0.5
      const overlappingRanges: Array<{ start: number; end: number }> = []

      for (const other of edges) {
        if (edge === other) continue
        if (edge.rect === other.rect) continue
        if (!edge.zLayers.some((z) => other.zLayers.includes(z))) continue

        const isOtherHorizontal = Math.abs(other.normal.y) > 0.5
        if (isHorizontal !== isOtherHorizontal) continue

        if (isHorizontal) {
          if (Math.abs(edge.y1 - other.y1) > tolerance) continue

          const overlapStart = Math.max(edge.x1, other.x1)
          const overlapEnd = Math.min(edge.x2, other.x2)

          if (overlapStart < overlapEnd) {
            const edgeLength = edge.x2 - edge.x1
            overlappingRanges.push({
              start: (overlapStart - edge.x1) / edgeLength,
              end: (overlapEnd - edge.x1) / edgeLength,
            })
          }
        } else {
          if (Math.abs(edge.x1 - other.x1) > tolerance) continue

          const overlapStart = Math.max(edge.y1, other.y1)
          const overlapEnd = Math.min(edge.y2, other.y2)

          if (overlapStart < overlapEnd) {
            const edgeLength = edge.y2 - edge.y1
            overlappingRanges.push({
              start: (overlapStart - edge.y1) / edgeLength,
              end: (overlapEnd - edge.y1) / edgeLength,
            })
          }
        }
      }

      if (overlappingRanges.length === 0) {
        result.push(edge)
        continue
      }

      overlappingRanges.sort((a, b) => a.start - b.start)
      const merged: Array<{ start: number; end: number }> = []
      for (const range of overlappingRanges) {
        if (
          merged.length === 0 ||
          range.start > merged[merged.length - 1]!.end
        ) {
          merged.push(range)
        } else {
          merged[merged.length - 1]!.end = Math.max(
            merged[merged.length - 1]!.end,
            range.end,
          )
        }
      }

      let pos = 0
      for (const occupied of merged) {
        if (pos < occupied.start) {
          const freeSegment = this.createEdgeSegment(edge, pos, occupied.start)
          result.push(freeSegment)
        }
        pos = occupied.end
      }
      if (pos < 1) {
        const freeSegment = this.createEdgeSegment(edge, pos, 1)
        result.push(freeSegment)
      }
    }
    result.sort((a, b) => {
      const lengthA = Math.hypot(a.x2 - a.x1, a.y2 - a.y1)
      const lengthB = Math.hypot(b.x2 - b.x1, b.y2 - b.y1)
      return lengthB - lengthA
    })

    return result
  }

  private createEdgeSegment(
    edge: RectEdge,
    start: number,
    end: number,
  ): RectEdge {
    const isHorizontal = Math.abs(edge.normal.y) > 0.5

    if (isHorizontal) {
      const length = edge.x2 - edge.x1
      return {
        ...edge,
        x1: edge.x1 + start * length,
        x2: edge.x1 + end * length,
      }
    } else {
      const length = edge.y2 - edge.y1
      return {
        ...edge,
        y1: edge.y1 + start * length,
        y2: edge.y1 + end * length,
      }
    }
  }

  override _setup(): void {
    this.stats = {
      phase: "EDGE_ANALYSIS",
      edgeIndex: 0,
      totalEdges: this.state.edges.length,
      filledCount: 0,
    }
  }

  override _step(): void {
    switch (this.state.phase) {
      case "SELECT_PRIMARY_EDGE":
        this.stepSelectPrimaryEdge()
        break
      case "FIND_NEARBY_EDGES":
        this.stepFindNearbyEdges()
        break
      case "CHECK_UNOCCUPIED":
        this.stepCheckUnoccupied()
        break
      case "PLACE_EXPANSION_POINTS":
        this.stepPlaceExpansionPoints()
        break
      case "EXPAND_POINT":
        this.stepExpandPoint()
        break
      case "DONE":
        this.solved = true
        break
    }

    this.stats.phase = this.state.phase
    this.stats.edgeIndex = this.state.currentEdgeIndex
    this.stats.filledCount = this.state.filledRects.length
  }

  private stepSelectPrimaryEdge(): void {
    if (this.state.currentEdgeIndex >= this.state.edges.length) {
      this.state.phase = "DONE"
      return
    }

    this.state.currentPrimaryEdge =
      this.state.edges[this.state.currentEdgeIndex]
    this.state.nearbyEdgeCandidateIndex = 0
    this.state.currentNearbyEdges = []

    this.state.phase = "FIND_NEARBY_EDGES"
  }

  private stepFindNearbyEdges(): void {
    const primaryEdge = this.state.currentPrimaryEdge!

    const padding = this.state.maxEdgeDistance
    const minX = Math.min(primaryEdge.x1, primaryEdge.x2) - padding
    const minY = Math.min(primaryEdge.y1, primaryEdge.y2) - padding
    const maxX = Math.max(primaryEdge.x1, primaryEdge.x2) + padding
    const maxY = Math.max(primaryEdge.y1, primaryEdge.y2) + padding

    const candidates = this.state.edgeSpatialIndex.search(
      minX,
      minY,
      maxX,
      maxY,
    )

    // Collect nearby parallel edges
    this.state.currentNearbyEdges = []
    for (const candidate of candidates) {
      if (
        candidate !== primaryEdge &&
        this.isNearbyParallelEdge(primaryEdge, candidate)
      ) {
        this.state.currentNearbyEdges.push(candidate)
      }
    }

    // Sort by distance (furthest first) to try largest fills first
    this.state.currentNearbyEdges.sort((a, b) => {
      const distA = this.distanceBetweenEdges(primaryEdge, a)
      const distB = this.distanceBetweenEdges(primaryEdge, b)
      return distB - distA
    })

    this.state.phase = "CHECK_UNOCCUPIED"
  }

  private stepCheckUnoccupied(): void {
    this.state.phase = "PLACE_EXPANSION_POINTS"
  }

  private stepPlaceExpansionPoints(): void {
    const primaryEdge = this.state.currentPrimaryEdge!
    this.state.currentExpansionPoints = this.placeExpansionPoints(primaryEdge)
    this.state.currentExpansionIndex = 0

    if (this.state.currentExpansionPoints.length > 0) {
      this.state.phase = "EXPAND_POINT"
    } else {
      this.moveToNextEdge()
    }
  }

  private stepExpandPoint(): void {
    if (
      this.state.currentExpansionIndex <
      this.state.currentExpansionPoints.length
    ) {
      const point =
        this.state.currentExpansionPoints[this.state.currentExpansionIndex]!

      for (const nearbyEdge of this.state.currentNearbyEdges) {
        const filledRect = this.expandPointToRect(point, nearbyEdge)
        if (filledRect) {
          const overlapsExisting = this.overlapsExistingFill(filledRect)
          const overlapsInput = this.overlapsInputRects(filledRect)
          const overlapsObst = this.overlapsObstacles(filledRect)
          const hasMinSize = this.hasMinimumSize(filledRect)

          if (
            !overlapsExisting &&
            !overlapsInput &&
            !overlapsObst &&
            hasMinSize
          ) {
            this.state.filledRects.push(filledRect)
            break
          }
        }
      }

      this.state.currentExpansionIndex++
    } else {
      this.moveToNextEdge()
    }
  }

  private overlapsExistingFill(candidate: Placed3D): boolean {
    for (const existing of this.state.filledRects) {
      const sharedLayers = candidate.zLayers.filter((z) =>
        existing.zLayers.includes(z),
      )
      if (sharedLayers.length === 0) continue

      const overlapX =
        Math.max(candidate.rect.x, existing.rect.x) <
        Math.min(
          candidate.rect.x + candidate.rect.width,
          existing.rect.x + existing.rect.width,
        )
      const overlapY =
        Math.max(candidate.rect.y, existing.rect.y) <
        Math.min(
          candidate.rect.y + candidate.rect.height,
          existing.rect.y + existing.rect.height,
        )

      if (overlapX && overlapY) {
        return true
      }
    }

    return false
  }

  private overlapsInputRects(candidate: Placed3D): boolean {
    for (const input of this.state.inputRects) {
      const sharedLayers = candidate.zLayers.filter((z) =>
        input.zLayers.includes(z),
      )
      if (sharedLayers.length === 0) continue

      const overlapX =
        Math.max(candidate.rect.x, input.rect.x) <
        Math.min(
          candidate.rect.x + candidate.rect.width,
          input.rect.x + input.rect.width,
        )
      const overlapY =
        Math.max(candidate.rect.y, input.rect.y) <
        Math.min(
          candidate.rect.y + candidate.rect.height,
          input.rect.y + input.rect.height,
        )

      if (overlapX && overlapY) {
        return true
      }
    }

    return false
  }

  private overlapsObstacles(candidate: Placed3D): boolean {
    for (const z of candidate.zLayers) {
      const obstacles = this.state.obstaclesByLayer[z] ?? []
      for (const obstacle of obstacles) {
        const overlapX =
          Math.max(candidate.rect.x, obstacle.x) <
          Math.min(
            candidate.rect.x + candidate.rect.width,
            obstacle.x + obstacle.width,
          )
        const overlapY =
          Math.max(candidate.rect.y, obstacle.y) <
          Math.min(
            candidate.rect.y + candidate.rect.height,
            obstacle.y + obstacle.height,
          )

        if (overlapX && overlapY) {
          return true
        }
      }
    }

    return false
  }

  private hasMinimumSize(candidate: Placed3D): boolean {
    const minSize = 0.01
    return candidate.rect.width >= minSize && candidate.rect.height >= minSize
  }

  private expandPointToRect(
    point: ExpansionPoint,
    nearbyEdge: RectEdge,
  ): Placed3D | null {
    const edge = point.edge

    let rect: { x: number; y: number; width: number; height: number }

    if (Math.abs(edge.normal.x) > 0.5) {
      const leftX = edge.normal.x > 0 ? edge.x1 : nearbyEdge.x1
      const rightX = edge.normal.x > 0 ? nearbyEdge.x1 : edge.x1

      rect = {
        x: leftX,
        y: edge.y1,
        width: rightX - leftX,
        height: edge.y2 - edge.y1,
      }
    } else {
      const bottomY = edge.normal.y > 0 ? edge.y1 : nearbyEdge.y1
      const topY = edge.normal.y > 0 ? nearbyEdge.y1 : edge.y1

      rect = {
        x: edge.x1,
        y: bottomY,
        width: edge.x2 - edge.x1,
        height: topY - bottomY,
      }
    }

    return {
      rect,
      zLayers: [...point.zLayers],
    }
  }

  private moveToNextEdge(): void {
    this.state.currentEdgeIndex++
    this.state.phase = "SELECT_PRIMARY_EDGE"
    this.state.currentNearbyEdges = []
    this.state.currentExpansionPoints = []
  }

  private isNearbyParallelEdge(
    primaryEdge: RectEdge,
    candidate: RectEdge,
  ): boolean {
    const dotProduct =
      primaryEdge.normal.x * candidate.normal.x +
      primaryEdge.normal.y * candidate.normal.y

    if (dotProduct >= -0.9) return false // Not opposite (not facing)

    const sharedLayers = primaryEdge.zLayers.filter((z) =>
      candidate.zLayers.includes(z),
    )
    if (sharedLayers.length === 0) return false

    const distance = this.distanceBetweenEdges(primaryEdge, candidate)
    const minGap = Math.max(this.state.minTraceWidth, 0.1)
    if (distance < minGap) {
      return false
    }
    if (distance > this.state.maxEdgeDistance) {
      return false
    }

    return true
  }

  private distanceBetweenEdges(edge1: RectEdge, edge2: RectEdge): number {
    if (Math.abs(edge1.normal.y) > 0.5) {
      return Math.abs(edge1.y1 - edge2.y1)
    }
    return Math.abs(edge1.x1 - edge2.x1)
  }

  private placeExpansionPoints(edge: RectEdge): ExpansionPoint[] {
    const offsetDistance = 0.05
    const midX = (edge.x1 + edge.x2) / 2
    const midY = (edge.y1 + edge.y2) / 2

    return [
      {
        x: midX + edge.normal.x * offsetDistance,
        y: midY + edge.normal.y * offsetDistance,
        zLayers: [...edge.zLayers],
        edge,
      },
    ]
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    const meshNodes: CapacityMeshNode[] = this.state.filledRects.map(
      (placed, index) => ({
        capacityMeshNodeId: `gap-fill-${index}`,
        x: placed.rect.x,
        y: placed.rect.y,
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        availableZ: placed.zLayers,
        layer: placed.zLayers[0]?.toString() ?? "0",
      }),
    )

    return { meshNodes }
  }

  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []
    const lines: NonNullable<GraphicsObject["lines"]> = []

    // Draw input rectangles (light gray)
    for (const placed of this.state.inputRects) {
      rects.push({
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        fill: "#f3f4f6",
        stroke: "#9ca3af",
        label: `input rect\npos: (${placed.rect.x.toFixed(2)}, ${placed.rect.y.toFixed(2)})\nsize: ${placed.rect.width.toFixed(2)} × ${placed.rect.height.toFixed(2)}\nz: [${placed.zLayers.join(", ")}]`,
      })
    }

    for (let z = 0; z < this.state.obstaclesByLayer.length; z++) {
      const obstacles = this.state.obstaclesByLayer[z] ?? []
      for (const obstacle of obstacles) {
        rects.push({
          center: {
            x: obstacle.x + obstacle.width / 2,
            y: obstacle.y + obstacle.height / 2,
          },
          width: obstacle.width,
          height: obstacle.height,
          fill: "#fee2e2",
          stroke: "#ef4444",
          label: `obstacle\npos: (${obstacle.x.toFixed(2)}, ${obstacle.y.toFixed(2)})\nsize: ${obstacle.width.toFixed(2)} × ${obstacle.height.toFixed(2)}\nz: ${z}`,
        })
      }
    }

    for (const edge of this.state.edges) {
      const isCurrent = edge === this.state.currentPrimaryEdge

      lines.push({
        points: [
          { x: edge.x1, y: edge.y1 },
          { x: edge.x2, y: edge.y2 },
        ],
        strokeColor: "#10b981",
        strokeWidth: isCurrent ? 0.2 : 0.1,
        label: `${edge.side}\n(${edge.x1.toFixed(2)},${edge.y1.toFixed(2)})-(${edge.x2.toFixed(2)},${edge.y2.toFixed(2)})`,
      })

      if (isCurrent) {
        points.push({
          x: (edge.x1 + edge.x2) / 2,
          y: (edge.y1 + edge.y2) / 2,
        })
      }
    }

    // Draw filled rectangles (green)
    for (const placed of this.state.filledRects) {
      rects.push({
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        fill: "#d1fae5",
        stroke: "#10b981",
        label: `filled gap\npos: (${placed.rect.x.toFixed(2)}, ${placed.rect.y.toFixed(2)})\nsize: ${placed.rect.width.toFixed(2)} × ${placed.rect.height.toFixed(2)}\nz: [${placed.zLayers.join(", ")}]`,
      })
    }

    return {
      title: `Gap Fill (Edge ${this.state.currentEdgeIndex}/${this.state.edges.length})`,
      coordinateSystem: "cartesian",
      rects,
      points,
      lines,
    }
  }
}
