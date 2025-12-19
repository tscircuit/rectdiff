import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { Placed3D, XYRect } from "../rectdiff/types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { FlatbushIndex } from "../../data-structures/FlatbushIndex"
import type { RectEdge } from "./types"
import { extractEdges } from "./extractEdges"
import { splitEdgesOnOverlaps } from "./splitEdgesOnOverlaps"
import { buildEdgeSpatialIndex } from "./buildEdgeSpatialIndex"
import { overlaps } from "../rectdiff/geometry"

const COLOR_MAP = {
  inputRectFill: "#f3f4f6",
  inputRectStroke: "#9ca3af",
  obstacleRectFill: "#fee2e2",
  obstacleRectStroke: "#fc6e6eff",
  edgeStroke: "#10b981",
  filledGapFill: "#d1fae5",
  filledGapStroke: "#10b981",
}

export interface EdgeSpatialHashIndexInput {
  simpleRouteJson: SimpleRouteJson
  placedRects: Placed3D[]
  obstaclesByLayer: XYRect[][]
  maxEdgeDistance?: number
}

type SubPhase =
  | "SELECT_PRIMARY_EDGE"
  | "FIND_NEARBY_EDGES"
  | "EXPAND_POINT"
  | "DONE"

interface EdgeSpatialHashIndexState {
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

  filledRects: Placed3D[]
}

/**
 * Gap Fill Solver - fills gaps between existing rectangles using edge analysis.
 * Processes one edge per step for visualization.
 */
export class EdgeSpatialHashIndex extends BaseSolver {
  private state!: EdgeSpatialHashIndexState

  constructor(input: EdgeSpatialHashIndexInput) {
    super()
    this.state = this.initState(input)
  }

  private initState(
    input: EdgeSpatialHashIndexInput,
  ): EdgeSpatialHashIndexState {
    const layerCount = input.simpleRouteJson.layerCount || 1
    const maxEdgeDistance = input.maxEdgeDistance ?? 2.0

    const rawEdges = extractEdges(input.placedRects, input.obstaclesByLayer)
    const edges = splitEdgesOnOverlaps(rawEdges)

    const edgeSpatialIndex = buildEdgeSpatialIndex(edges, maxEdgeDistance)

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
      filledRects: [],
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

    const edgesWithDist = this.state.currentNearbyEdges.map((edge) => ({
      edge,
      distance: this.distanceBetweenEdges(primaryEdge, edge),
    }))
    edgesWithDist.sort((a, b) => b.distance - a.distance)
    this.state.currentNearbyEdges = edgesWithDist.map((e) => e.edge)

    this.state.phase = "EXPAND_POINT"
  }

  private stepExpandPoint(): void {
    const primaryEdge = this.state.currentPrimaryEdge!

    for (const nearbyEdge of this.state.currentNearbyEdges) {
      const filledRect = this.expandEdgeToRect(primaryEdge, nearbyEdge)
      if (filledRect && this.isValidFill(filledRect)) {
        this.state.filledRects.push(filledRect)
        break
      }
    }

    this.state.currentEdgeIndex++
    this.state.phase = "SELECT_PRIMARY_EDGE"
    this.state.currentNearbyEdges = []
  }

  private isValidFill(candidate: Placed3D): boolean {
    const minSize = 0.01
    if (candidate.rect.width < minSize || candidate.rect.height < minSize) {
      return false
    }

    // Check filled rects
    for (const existing of this.state.filledRects) {
      if (
        candidate.zLayers.some((z) => existing.zLayers.includes(z)) &&
        overlaps(candidate.rect, existing.rect)
      ) {
        return false
      }
    }

    // Check input rects
    for (const input of this.state.inputRects) {
      if (
        candidate.zLayers.some((z) => input.zLayers.includes(z)) &&
        overlaps(candidate.rect, input.rect)
      ) {
        return false
      }
    }

    // Check obstacles
    for (const z of candidate.zLayers) {
      const obstacles = this.state.obstaclesByLayer[z] ?? []
      for (const obstacle of obstacles) {
        if (overlaps(candidate.rect, obstacle)) {
          return false
        }
      }
    }

    return true
  }

  private expandEdgeToRect(
    primaryEdge: RectEdge,
    nearbyEdge: RectEdge,
  ): Placed3D | null {
    let rect: { x: number; y: number; width: number; height: number }

    if (Math.abs(primaryEdge.normal.x) > 0.5) {
      const leftX = primaryEdge.normal.x > 0 ? primaryEdge.x1 : nearbyEdge.x1
      const rightX = primaryEdge.normal.x > 0 ? nearbyEdge.x1 : primaryEdge.x1

      rect = {
        x: leftX,
        y: primaryEdge.y1,
        width: rightX - leftX,
        height: primaryEdge.y2 - primaryEdge.y1,
      }
    } else {
      const bottomY = primaryEdge.normal.y > 0 ? primaryEdge.y1 : nearbyEdge.y1
      const topY = primaryEdge.normal.y > 0 ? nearbyEdge.y1 : primaryEdge.y1

      rect = {
        x: primaryEdge.x1,
        y: bottomY,
        width: primaryEdge.x2 - primaryEdge.x1,
        height: topY - bottomY,
      }
    }

    return {
      rect,
      zLayers: [...primaryEdge.zLayers],
    }
  }

  private isNearbyParallelEdge(
    primaryEdge: RectEdge,
    candidate: RectEdge,
  ): boolean {
    const dotProduct =
      primaryEdge.normal.x * candidate.normal.x +
      primaryEdge.normal.y * candidate.normal.y

    if (dotProduct >= -0.9) return false

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

    for (const placed of this.state.inputRects) {
      rects.push({
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        fill: COLOR_MAP.inputRectFill,
        stroke: COLOR_MAP.inputRectStroke,
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
          fill: COLOR_MAP.obstacleRectFill,
          stroke: COLOR_MAP.obstacleRectStroke,
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
        strokeColor: COLOR_MAP.edgeStroke,
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

    for (const placed of this.state.filledRects) {
      rects.push({
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        fill: COLOR_MAP.filledGapFill,
        stroke: COLOR_MAP.filledGapStroke,
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
