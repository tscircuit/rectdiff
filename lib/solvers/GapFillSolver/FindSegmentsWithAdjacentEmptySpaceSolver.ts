import { BaseSolver } from "@tscircuit/solver-utils"
import Flatbush from "flatbush"
import type { GraphicsObject, NinePointAnchor } from "graphics-debug"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { projectToUncoveredSegments } from "./projectToUncoveredSegments"
import { EDGES } from "./edge-constants"
import { visuallyOffsetLine } from "./visuallyOffsetLine"
import type { Bounds } from "@tscircuit/math-utils"
import { getBoundFromCenteredRect } from "@tscircuit/math-utils"

export interface SegmentWithAdjacentEmptySpace {
  parent: CapacityMeshNode
  start: { x: number; y: number }
  end: { x: number; y: number }
  z: number
  facingDirection: "x+" | "x-" | "y+" | "y-"
}

const EPS = 1e-4

const clipNodeToBounds = (
  node: CapacityMeshNode,
  bounds?: Bounds,
): {
  center: { x: number; y: number }
  width: number
  height: number
  minX: number
  maxX: number
  minY: number
  maxY: number
} | null => {
  const nodeBounds = getBoundFromCenteredRect(node)
  if (!bounds) {
    return {
      ...nodeBounds,
      center: node.center,
      width: node.width,
      height: node.height,
    }
  }

  const minX = Math.max(nodeBounds.minX, bounds.minX)
  const maxX = Math.min(nodeBounds.maxX, bounds.maxX)
  const minY = Math.max(nodeBounds.minY, bounds.minY)
  const maxY = Math.min(nodeBounds.maxY, bounds.maxY)
  const width = maxX - minX
  const height = maxY - minY

  if (width <= EPS || height <= EPS) return null

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  }
}

const isBoundaryFacingEdge = (
  edgeDirection: SegmentWithAdjacentEmptySpace["facingDirection"],
  rectBounds: { minX: number; maxX: number; minY: number; maxY: number },
  bounds?: Bounds,
) => {
  if (!bounds) return false

  switch (edgeDirection) {
    case "x-":
      return Math.abs(rectBounds.minX - bounds.minX) < EPS
    case "x+":
      return Math.abs(rectBounds.maxX - bounds.maxX) < EPS
    case "y-":
      return Math.abs(rectBounds.minY - bounds.minY) < EPS
    case "y+":
      return Math.abs(rectBounds.maxY - bounds.maxY) < EPS
  }
}

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
      bounds?: Bounds
    },
  ) {
    super()
    for (const node of this.input.meshNodes) {
      const effectiveNode = clipNodeToBounds(node, this.input.bounds)
      if (!effectiveNode) continue

      for (const edge of EDGES) {
        if (
          isBoundaryFacingEdge(
            edge.facingDirection,
            effectiveNode,
            this.input.bounds,
          )
        ) {
          continue
        }

        let start = {
          x: effectiveNode.center.x + effectiveNode.width * edge.startX,
          y: effectiveNode.center.y + effectiveNode.height * edge.startY,
        }
        let end = {
          x: effectiveNode.center.x + effectiveNode.width * edge.endX,
          y: effectiveNode.center.y + effectiveNode.height * edge.endY,
        }

        // Ensure start.x < end.x and if x is the same, ensure start.y < end.y
        if (start.x > end.x) {
          ;[start, end] = [end, start]
        }
        if (Math.abs(start.x - end.x) < EPS && start.y > end.y) {
          ;[start, end] = [end, start]
        }

        for (const z of node.availableZ) {
          this.unprocessedEdges.push({
            parent: node,
            start,
            end,
            facingDirection: edge.facingDirection,
            z,
          })
        }
      }
    }
    this.allEdges = [...this.unprocessedEdges]

    this.edgeSpatialIndex = new Flatbush(this.allEdges.length)
    for (const edge of this.allEdges) {
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
      this.lastCandidateEdge = null
      this.lastOverlappingEdges = null
      this.lastUncoveredSegments = null
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

    const overlappingEdges = nearbyEdges
      .map((i) => this.allEdges[i]!)
      .filter((e) => e.z === candidateEdge.z)
    this.lastOverlappingEdges = overlappingEdges

    const uncoveredSegments = projectToUncoveredSegments(
      candidateEdge,
      overlappingEdges,
    )
    this.lastUncoveredSegments = uncoveredSegments
    this.segmentsWithAdjacentEmptySpace.push(...uncoveredSegments)
  }

  override getOutput(): {
    segmentsWithAdjacentEmptySpace: Array<SegmentWithAdjacentEmptySpace>
  } {
    return {
      segmentsWithAdjacentEmptySpace: this.segmentsWithAdjacentEmptySpace,
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
      infiniteLines: [],
      polygons: [],
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
          { dir: unprocessedEdge.facingDirection, amt: -0.1 },
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
    }

    if (this.lastOverlappingEdges) {
      for (const edge of this.lastOverlappingEdges) {
        graphics.lines.push({
          points: visuallyOffsetLine([edge.start, edge.end], {
            dir: edge.facingDirection,
            amt: 0.05,
          }),
          strokeColor: "red",
          strokeDash: "2 2",
        })
      }
    }

    if (this.lastUncoveredSegments) {
      for (const edge of this.lastUncoveredSegments) {
        graphics.lines.push({
          points: visuallyOffsetLine([edge.start, edge.end], {
            dir: edge.facingDirection,
            amt: -0.05,
          }),
          strokeColor: "green",
          strokeDash: "2 2",
        })
      }
    }

    return graphics
  }
}
