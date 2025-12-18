import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { SimpleRouteJson } from "../types/srj-types"
import type { Placed3D, XYRect } from "./rectdiff/types"
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

export interface UnoccupiedSection {
  edge: RectEdge
  start: number // 0 to 1 along edge
  end: number // 0 to 1 along edge
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ExpansionPoint {
  x: number
  y: number
  zLayers: number[]
  section: UnoccupiedSection
}

export interface GapFillSolverInput {
  simpleRouteJson: SimpleRouteJson
  placedRects: Placed3D[]
  obstaclesByLayer: XYRect[][]
  maxEdgeDistance?: number // Max distance to consider edges "nearby" (default: 2.0)
}

// Sub-phases for visualization
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

  edges: RectEdge[]
  edgeSpatialIndex: FlatbushIndex<RectEdge>

  phase: SubPhase
  currentEdgeIndex: number
  currentPrimaryEdge?: RectEdge

  nearbyEdgeCandidateIndex: number
  currentNearbyEdges: RectEdge[]

  currentUnoccupiedSections: UnoccupiedSection[]

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

    const rawEdges = this.extractEdges(input.placedRects)
    const edges = this.splitEdgesOnOverlaps(rawEdges, maxEdgeDistance)

    // Build spatial index for fast edge-to-edge queries
    const edgeSpatialIndex = this.buildEdgeSpatialIndex(edges, maxEdgeDistance)

    return {
      srj: input.simpleRouteJson,
      inputRects: input.placedRects,
      obstaclesByLayer: input.obstaclesByLayer,
      layerCount,
      maxEdgeDistance,
      edges,
      edgeSpatialIndex,
      phase: "SELECT_PRIMARY_EDGE",
      currentEdgeIndex: 0,
      nearbyEdgeCandidateIndex: 0,
      currentNearbyEdges: [],
      currentUnoccupiedSections: [],
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
      // Create bounding box for edge (padded by max search distance)
      const minX = Math.min(edge.x1, edge.x2) - maxEdgeDistance
      const minY = Math.min(edge.y1, edge.y2) - maxEdgeDistance
      const maxX = Math.max(edge.x1, edge.x2) + maxEdgeDistance
      const maxY = Math.max(edge.y1, edge.y2) + maxEdgeDistance

      index.insert(edge, minX, minY, maxX, maxY)
    }

    index.finish()
    return index
  }

  private extractEdges(rects: Placed3D[]): RectEdge[] {
    const edges: RectEdge[] = []

    for (const placed of rects) {
      const { rect, zLayers } = placed

      // Top edge (y = rect.y + rect.height)
      edges.push({
        rect,
        side: "top",
        x1: rect.x,
        y1: rect.y + rect.height,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        normal: { x: 0, y: 1 }, // Points up
        zLayers: [...zLayers],
      })

      // Bottom edge (y = rect.y)
      edges.push({
        rect,
        side: "bottom",
        x1: rect.x,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y,
        normal: { x: 0, y: -1 }, // Points down
        zLayers: [...zLayers],
      })

      // Right edge (x = rect.x + rect.width)
      edges.push({
        rect,
        side: "right",
        x1: rect.x + rect.width,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
        normal: { x: 1, y: 0 }, // Points right
        zLayers: [...zLayers],
      })

      // Left edge (x = rect.x)
      edges.push({
        rect,
        side: "left",
        x1: rect.x,
        y1: rect.y,
        x2: rect.x,
        y2: rect.y + rect.height,
        normal: { x: -1, y: 0 }, // Points left
        zLayers: [...zLayers],
      })
    }

    return edges
  }

  private splitEdgesOnOverlaps(edges: RectEdge[], maxEdgeDistance: number): RectEdge[] {
    console.log(`\n=== splitEdgesOnOverlaps START ===`)
    console.log(`Input edges: ${edges.length}`)

    const result: RectEdge[] = []

    for (const edge of edges) {
      const isHorizontal = Math.abs(edge.normal.y) > 0.5
      const occupiedRanges: Array<{ start: number; end: number }> = []

      console.log(`\nProcessing edge ${edge.side}: (${edge.x1},${edge.y1})-(${edge.x2},${edge.y2}) normal:(${edge.normal.x},${edge.normal.y})`)

      for (const other of edges) {
        if (edge === other) continue
        if (edge.rect === other.rect) continue // Skip same rectangle's edges
        if (!edge.zLayers.some((z) => other.zLayers.includes(z))) continue

        const isOtherHorizontal = Math.abs(other.normal.y) > 0.5
        if (isHorizontal !== isOtherHorizontal) continue

        // Check if edges are actually nearby (not just parallel)
        if (isHorizontal) {
          const distance = Math.abs(edge.y1 - other.y1)
          if (distance > maxEdgeDistance) continue
        } else {
          const distance = Math.abs(edge.x1 - other.x1)
          if (distance > maxEdgeDistance) continue
        }

        let overlapStart: number, overlapEnd: number

        if (isHorizontal) {
          overlapStart = Math.max(edge.x1, other.x1)
          overlapEnd = Math.min(edge.x2, other.x2)
        } else {
          overlapStart = Math.max(edge.y1, other.y1)
          overlapEnd = Math.min(edge.y2, other.y2)
        }

        if (overlapStart < overlapEnd) {
          const edgeLength = isHorizontal ? edge.x2 - edge.x1 : edge.y2 - edge.y1
          const edgeStart = isHorizontal ? edge.x1 : edge.y1
          const range = {
            start: (overlapStart - edgeStart) / edgeLength,
            end: (overlapEnd - edgeStart) / edgeLength,
          }
          console.log(`  Found overlap with ${other.side}: range ${range.start.toFixed(2)}-${range.end.toFixed(2)}`)
          occupiedRanges.push(range)
        }
      }

      if (occupiedRanges.length === 0) {
        console.log(`  No overlaps, keeping full edge`)
        result.push(edge)
        continue
      }

      occupiedRanges.sort((a, b) => a.start - b.start)
      const merged: Array<{ start: number; end: number }> = []
      for (const range of occupiedRanges) {
        if (merged.length === 0 || range.start > merged[merged.length - 1]!.end) {
          merged.push(range)
        } else {
          merged[merged.length - 1]!.end = Math.max(
            merged[merged.length - 1]!.end,
            range.end,
          )
        }
      }

      console.log(`  Merged overlaps: ${merged.map(m => `${m.start.toFixed(2)}-${m.end.toFixed(2)}`).join(', ')}`)

      let pos = 0
      for (const occupied of merged) {
        if (pos < occupied.start) {
          console.log(`  Creating free segment: ${pos.toFixed(2)}-${occupied.start.toFixed(2)}`)
          result.push(this.createEdgeSegment(edge, pos, occupied.start))
        }
        pos = occupied.end
      }
      if (pos < 1) {
        console.log(`  Creating free segment: ${pos.toFixed(2)}-1.00`)
        result.push(this.createEdgeSegment(edge, pos, 1))
      }

      for (const occupied of merged) {
        console.log(`  Creating overlap segment: ${occupied.start.toFixed(2)}-${occupied.end.toFixed(2)}`)
        result.push(this.createEdgeSegment(edge, occupied.start, occupied.end))
      }
    }

    console.log(`\nOutput edges: ${result.length}`)
    console.log(`=== splitEdgesOnOverlaps END ===\n`)
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

    // Query spatial index for candidate edges near this primary edge
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

    // Check only the nearby candidates (not all edges!)
    // Collect ALL nearby parallel edges
    this.state.currentNearbyEdges = []
    for (const candidate of candidates) {
      if (
        candidate !== primaryEdge &&
        this.isNearbyParallelEdge(primaryEdge, candidate)
      ) {
        this.state.currentNearbyEdges.push(candidate)
      }
    }
    this.state.phase = "CHECK_UNOCCUPIED"
  }

  private stepCheckUnoccupied(): void {
    const primaryEdge = this.state.currentPrimaryEdge!
    this.state.currentUnoccupiedSections =
      this.findUnoccupiedSections(primaryEdge)

    this.state.phase = "PLACE_EXPANSION_POINTS"
  }

  private stepPlaceExpansionPoints(): void {
    this.state.currentExpansionPoints = this.placeExpansionPoints(
      this.state.currentUnoccupiedSections,
    )
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

      const filledRect = this.expandPointToRect(point)
      if (
        filledRect &&
        !this.overlapsExistingFill(filledRect) &&
        !this.overlapsInputRects(filledRect) &&
        !this.overlapsObstacles(filledRect) &&
        this.hasMinimumSize(filledRect)
      ) {
        this.state.filledRects.push(filledRect)
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

  private expandPointToRect(point: ExpansionPoint): Placed3D | null {
    const section = point.section
    const edge = section.edge

    const nearbyEdge = this.state.currentNearbyEdges[0]
    if (!nearbyEdge) return null

    let rect: { x: number; y: number; width: number; height: number }

    if (Math.abs(edge.normal.x) > 0.5) {
      const leftX = edge.normal.x > 0 ? edge.x1 : nearbyEdge.x1
      const rightX = edge.normal.x > 0 ? nearbyEdge.x1 : edge.x1

      rect = {
        x: leftX,
        y: section.y1,
        width: rightX - leftX,
        height: section.y2 - section.y1,
      }
    } else {
      const bottomY = edge.normal.y > 0 ? edge.y1 : nearbyEdge.y1
      const topY = edge.normal.y > 0 ? nearbyEdge.y1 : edge.y1

      rect = {
        x: section.x1,
        y: bottomY,
        width: section.x2 - section.x1,
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
    this.state.currentUnoccupiedSections = []
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
    if (distance > this.state.maxEdgeDistance) return false

    return true
  }

  private distanceBetweenEdges(edge1: RectEdge, edge2: RectEdge): number {
    if (Math.abs(edge1.normal.y) > 0.5) {
      return Math.abs(edge1.y1 - edge2.y1)
    }
    return Math.abs(edge1.x1 - edge2.x1)
  }

  private findUnoccupiedSections(edge: RectEdge): UnoccupiedSection[] {
    // TODO: Implement - check which parts of the edge have free space
    // For now, return the entire edge as one section
    return [
      {
        edge,
        start: 0,
        end: 1,
        x1: edge.x1,
        y1: edge.y1,
        x2: edge.x2,
        y2: edge.y2,
      },
    ]
  }

  private placeExpansionPoints(
    sections: UnoccupiedSection[],
  ): ExpansionPoint[] {
    const points: ExpansionPoint[] = []

    for (const section of sections) {
      const edge = section.edge

      const offsetDistance = 0.05
      const midX = (section.x1 + section.x2) / 2
      const midY = (section.y1 + section.y2) / 2

      points.push({
        x: midX + edge.normal.x * offsetDistance,
        y: midY + edge.normal.y * offsetDistance,
        zLayers: [...edge.zLayers],
        section,
      })
    }

    return points
  }

  override getOutput() {
    return {
      filledRects: this.state.filledRects,
    }
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

    // Highlight primary edge (bright blue)
    if (this.state.currentPrimaryEdge) {
      const e = this.state.currentPrimaryEdge
      lines.push({
        points: [
          { x: e.x1, y: e.y1 },
          { x: e.x2, y: e.y2 },
        ],
        strokeColor: "#3b82f6",
        strokeWidth: 0.08,
        label: `primary edge (${e.side})\n(${e.x1.toFixed(2)}, ${e.y1.toFixed(2)}) → (${e.x2.toFixed(2)}, ${e.y2.toFixed(2)})\nnormal: (${e.normal.x}, ${e.normal.y})\nz: [${e.zLayers.join(", ")}]`,
      })
    }

    // Highlight nearby edges (orange)
    for (const edge of this.state.currentNearbyEdges) {
      const distance = this.state.currentPrimaryEdge
        ? this.distanceBetweenEdges(
            this.state.currentPrimaryEdge,
            edge,
          ).toFixed(2)
        : "?"
      lines.push({
        points: [
          { x: edge.x1, y: edge.y1 },
          { x: edge.x2, y: edge.y2 },
        ],
        strokeColor: "#f97316",
        strokeWidth: 0.06,
        label: `nearby edge (${edge.side})\n(${edge.x1.toFixed(2)}, ${edge.y1.toFixed(2)}) → (${edge.x2.toFixed(2)}, ${edge.y2.toFixed(2)})\ndist: ${distance}mm\nz: [${edge.zLayers.join(", ")}]`,
      })
    }

    // Highlight unoccupied sections (green)
    for (const section of this.state.currentUnoccupiedSections) {
      const length = Math.sqrt(
        Math.pow(section.x2 - section.x1, 2) +
          Math.pow(section.y2 - section.y1, 2),
      )
      lines.push({
        points: [
          { x: section.x1, y: section.y1 },
          { x: section.x2, y: section.y2 },
        ],
        strokeColor: "#10b981",
        strokeWidth: 0.04,
        label: `unoccupied section\n(${section.x1.toFixed(2)}, ${section.y1.toFixed(2)}) → (${section.x2.toFixed(2)}, ${section.y2.toFixed(2)})\nlength: ${length.toFixed(2)}mm\nrange: ${(section.start * 100).toFixed(0)}%-${(section.end * 100).toFixed(0)}%`,
      })
    }

    // Show expansion points (purple)
    for (const point of this.state.currentExpansionPoints) {
      points.push({
        x: point.x,
        y: point.y,
        fill: "#a855f7",
        stroke: "#7e22ce",
        label: `expansion point\npos: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})\nz: [${point.zLayers.join(", ")}]`,
      } as any)
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
