import { BaseSolver } from "@tscircuit/solver-utils"
import Flatbush from "flatbush"
import type { GraphicsObject, NinePointAnchor } from "graphics-debug"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import { projectToUncoveredSegments } from "./projectToUncoveredSegments"
import { EDGES } from "./edge-constants"
import { visuallyOffsetLine } from "./visuallyOffsetLine"
import { midpoint } from "@tscircuit/math-utils"

export interface SegmentWithAdjacentEmptySpace {
  parent: CapacityMeshNode
  start: { x: number; y: number }
  end: { x: number; y: number }
  facingDirection: "x+" | "x-" | "y+" | "y-"
}

const EPS = 1e-4

/**
 * Find edges with adjacent empty space in the mesh
 *
 * Do this by iterating over each edge of the rect (each step is one edge)
 * and checking if the is completely covered by any other edge
 *
 * If it is completely covered, then it doesn't have an adjacent empty space,
 * continue
 *
 * If it is partially uncovered, then divide it into uncovered segments and add
 * each uncovered segment as a new edge with an adjacent empty space
 */
export class FindSegmentsWithAdjacentEmptySpaceSolver extends BaseSolver {
  allEdges: Array<SegmentWithAdjacentEmptySpace>
  unprocessedEdges: Array<SegmentWithAdjacentEmptySpace> = []

  segmentsWithAdjacentEmptySpace: Array<SegmentWithAdjacentEmptySpace> = []

  edgeSpatialIndex: Flatbush

  lastCandidateEdge: SegmentWithAdjacentEmptySpace | null = null
  lastOverlappingEdges: Array<SegmentWithAdjacentEmptySpace> | null = null
  lastUncoveredSegments: Array<SegmentWithAdjacentEmptySpace> | null = null

  constructor(
    private input: {
      meshNodes: CapacityMeshNode[]
    },
  ) {
    super()
    for (const node of this.input.meshNodes) {
      for (const edge of EDGES) {
        let start = {
          x: node.center.x + node.width * edge.startX,
          y: node.center.y + node.height * edge.startY,
        }
        let end = {
          x: node.center.x + node.width * edge.endX,
          y: node.center.y + node.height * edge.endY,
        }

        // Ensure start.x < end.x and if x is the same, ensure start.y < end.y
        if (start.x > end.x) {
          ;[start, end] = [end, start]
        }
        if (Math.abs(start.x - end.x) < EPS && start.y > end.y) {
          ;[start, end] = [end, start]
        }

        this.unprocessedEdges.push({
          parent: node,
          start,
          end,
          facingDirection: edge.facingDirection,
        })
      }
    }
    this.allEdges = [...this.unprocessedEdges]

    this.edgeSpatialIndex = new Flatbush(this.unprocessedEdges.length)
    for (const edge of this.unprocessedEdges) {
      this.edgeSpatialIndex.add(
        edge.start.x,
        edge.start.y,
        edge.end.x,
        edge.end.y,
      )
    }
    this.edgeSpatialIndex.finish()
  }

  override _step() {
    if (this.unprocessedEdges.length === 0) {
      this.solved = true
      return
    }

    const candidateEdge = this.unprocessedEdges.shift()!
    this.lastCandidateEdge = candidateEdge

    // Find all edges that are nearby
    const nearbyEdges = this.edgeSpatialIndex.search(
      candidateEdge.start.x - EPS,
      candidateEdge.start.y - EPS,
      candidateEdge.end.x + EPS,
      candidateEdge.end.y + EPS,
    )

    const overlappingEdges = nearbyEdges.map((i) => this.allEdges[i]!)
    this.lastOverlappingEdges = overlappingEdges

    const uncoveredSegments = projectToUncoveredSegments(
      candidateEdge,
      overlappingEdges,
    )
    this.lastUncoveredSegments = uncoveredSegments
    this.segmentsWithAdjacentEmptySpace.push(...uncoveredSegments)
  }

  override getOutput(): {
    edgesWithAdjacentEmptySpace: Array<SegmentWithAdjacentEmptySpace>
  } {
    return {
      edgesWithAdjacentEmptySpace: [], // TODO
    }
  }

  override visualize() {
    const graphics: Required<GraphicsObject> = {
      title: "FindSegmentsWithAdjacentEmptySpace",
      coordinateSystem: "cartesian" as const,
      rects: [],
      points: [],
      lines: [],
      circles: [],
      arrows: [],
      texts: [],
    }

    // Draw the capacity mesh nodes with gray, faded rects
    for (const node of this.input.meshNodes) {
      graphics.rects.push({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "rgba(0, 0, 0, 0.1)",
      })
    }

    for (const unprocessedEdge of this.unprocessedEdges) {
      graphics.lines.push({
        points: visuallyOffsetLine(
          [unprocessedEdge.start, unprocessedEdge.end],
          unprocessedEdge.facingDirection,
          -0.1,
        ),
        strokeColor: "rgba(0, 0, 255, 0.5)",
        strokeDash: "5 5",
      })
    }

    for (const edge of this.segmentsWithAdjacentEmptySpace) {
      graphics.lines.push({
        points: [edge.start, edge.end],
        strokeColor: "rgba(0,255,0, 0.5)",
      })
    }

    if (this.lastCandidateEdge) {
      graphics.lines.push({
        points: [this.lastCandidateEdge.start, this.lastCandidateEdge.end],
        strokeColor: "blue",
      })
      if (this.lastUncoveredSegments) {
        const mp = midpoint(
          this.lastCandidateEdge.start,
          this.lastCandidateEdge.end,
        )
        graphics.texts.push({
          text: `Uncovered segments: ${this.lastUncoveredSegments.length}`,
          x: mp.x,
          y: mp.y,
          fontSize: 0.5,
          anchorSide: {
            "x+": "left",
            "x-": "right",
            "y+": "top",
            "y-": "bottom",
          }[this.lastCandidateEdge.facingDirection] as NinePointAnchor,
        })
      }
    }

    if (this.lastOverlappingEdges) {
      for (const edge of this.lastOverlappingEdges) {
        graphics.lines.push({
          points: visuallyOffsetLine(
            [edge.start, edge.end],
            edge.facingDirection,
            0.05,
          ),
          strokeColor: "red",
          strokeDash: "2 2",
        })
      }
    }

    if (this.lastUncoveredSegments) {
      for (const edge of this.lastUncoveredSegments) {
        graphics.lines.push({
          points: visuallyOffsetLine(
            [edge.start, edge.end],
            edge.facingDirection,
            -0.05,
          ),
          strokeColor: "green",
          strokeDash: "2 2",
        })
      }
    }

    return graphics
  }
}
