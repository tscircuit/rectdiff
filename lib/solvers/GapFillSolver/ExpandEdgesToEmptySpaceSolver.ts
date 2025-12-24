import { BaseSolver } from "@tscircuit/solver-utils"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { SegmentWithAdjacentEmptySpace } from "./FindSegmentsWithAdjacentEmptySpaceSolver"
import type { GraphicsObject } from "graphics-debug"
import RBush from "rbush"
import { EDGE_MAP, EDGES } from "./edge-constants"
import { getBoundsFromCorners } from "./getBoundsFromCorners"
import type { Bounds } from "@tscircuit/math-utils"
import { midpoint, segmentToBoxMinDistance } from "@tscircuit/math-utils"
import type { XYRect } from "lib/rectdiff-types"

const EPS = 1e-4

type ExpandEdgesToEmptySpaceSolverInput = {
  inputMeshNodes: CapacityMeshNode[]
  segmentsWithAdjacentEmptySpace: Array<SegmentWithAdjacentEmptySpace>
  boardCutoutArea?: XYRect[]
}

export interface ExpandedSegment {
  segment: SegmentWithAdjacentEmptySpace
  newNode: CapacityMeshNode
}

type IndexedCapacityMeshNode = CapacityMeshNode & {
  minX: number
  minY: number
  maxX: number
  maxY: number
  _boardCutout?: boolean
}

export class ExpandEdgesToEmptySpaceSolver extends BaseSolver {
  unprocessedSegments: Array<SegmentWithAdjacentEmptySpace> = []
  expandedSegments: Array<ExpandedSegment> = []

  lastSegment: SegmentWithAdjacentEmptySpace | null = null
  lastSearchBounds: Bounds | null = null
  lastCollidingNodes: CapacityMeshNode[] | null = null
  lastSearchCorner1: { x: number; y: number } | null = null
  lastSearchCorner2: { x: number; y: number } | null = null
  lastExpandedSegment: ExpandedSegment | null = null

  rectSpatialIndex: RBush<IndexedCapacityMeshNode>

  constructor(private input: ExpandEdgesToEmptySpaceSolverInput) {
    super()
    this.unprocessedSegments = [...this.input.segmentsWithAdjacentEmptySpace]
    const allLayerZs = Array.from(
      new Set(
        this.input.inputMeshNodes.flatMap((n) => n.availableZ ?? []).sort(),
      ),
    )

    // Add board cutout areas as special mesh nodes that block expansion
    const boardCutoutNodes: IndexedCapacityMeshNode[] = (
      this.input.boardCutoutArea ?? []
    ).map((rect, idx) => {
      const center = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      }
      return {
        capacityMeshNodeId: `board-void-${idx}`,
        center,
        width: rect.width,
        height: rect.height,
        availableZ: allLayerZs.length ? allLayerZs : [0],
        layer: "board-void",
        _boardCutout: true,
        minX: center.x - rect.width / 2,
        minY: center.y - rect.height / 2,
        maxX: center.x + rect.width / 2,
        maxY: center.y + rect.height / 2,
      }
    })
    const meshNodesForIndex: IndexedCapacityMeshNode[] =
      this.input.inputMeshNodes.map((n) => ({
        ...n,
        minX: n.center.x - n.width / 2,
        minY: n.center.y - n.height / 2,
        maxX: n.center.x + n.width / 2,
        maxY: n.center.y + n.height / 2,
      }))
    this.rectSpatialIndex = new RBush<IndexedCapacityMeshNode>()
    this.rectSpatialIndex.load([...meshNodesForIndex, ...boardCutoutNodes])
  }

  override _step() {
    if (this.unprocessedSegments.length === 0) {
      this.solved = true
      return
    }

    const segment = this.unprocessedSegments.shift()!
    this.lastSegment = segment

    const { dx, dy } = EDGE_MAP[segment.facingDirection]

    // Determine the largest empty space that can be created by creating a rect
    // that grows in segment.facingDirection by progressively expanding the
    // bounds that we search for empty space. As soon as any rect appears in our
    // bounds we know the maximum size of the empty space that can be created.

    const deltaStartEnd = {
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y,
    }
    const segLength = Math.sqrt(deltaStartEnd.x ** 2 + deltaStartEnd.y ** 2)
    const normDeltaStartEnd = {
      x: deltaStartEnd.x / segLength,
      y: deltaStartEnd.y / segLength,
    }

    let collidingNodes: CapacityMeshNode[] | null = null
    let searchDistance = 1
    const searchCorner1 = {
      x: segment.start.x + dx * EPS + normDeltaStartEnd.x * EPS * 10,
      y: segment.start.y + dy * EPS + normDeltaStartEnd.y * EPS * 10,
    }
    const searchCorner2 = {
      x: segment.end.x + dx * EPS - normDeltaStartEnd.x * EPS * 10,
      y: segment.end.y + dy * EPS - normDeltaStartEnd.y * EPS * 10,
    }
    this.lastSearchCorner1 = searchCorner1
    this.lastSearchCorner2 = searchCorner2
    while (
      (!collidingNodes || collidingNodes.length === 0) &&
      searchDistance < 1000
    ) {
      const searchBounds = getBoundsFromCorners([
        searchCorner1,
        searchCorner2,
        {
          x: searchCorner1.x + dx * searchDistance,
          y: searchCorner1.y + dy * searchDistance,
        },
        {
          x: searchCorner2.x + dx * searchDistance,
          y: searchCorner2.y + dy * searchDistance,
        },
      ])
      this.lastSearchBounds = searchBounds
      collidingNodes = this.rectSpatialIndex
        .search(searchBounds)
        .filter(
          (n) => (n._boardCutout ?? false) || n.availableZ.includes(segment.z),
        )
        .filter(
          (n) => n.capacityMeshNodeId !== segment.parent.capacityMeshNodeId,
        )

      searchDistance *= 4
    }

    if (!collidingNodes || collidingNodes.length === 0) {
      // TODO, this means we need to expand the node to the boundary
      return
    }
    this.lastCollidingNodes = collidingNodes

    // Determine the expand distance from the colliding nodes
    let smallestDistance = Infinity
    for (const node of collidingNodes) {
      const distance = segmentToBoxMinDistance(segment.start, segment.end, node)
      if (distance < smallestDistance) {
        smallestDistance = distance
      }
    }
    const expandDistance = smallestDistance

    const nodeBounds = getBoundsFromCorners([
      segment.start,
      segment.end,
      {
        x: segment.start.x + dx * expandDistance,
        y: segment.start.y + dy * expandDistance,
      },
      {
        x: segment.end.x + dx * expandDistance,
        y: segment.end.y + dy * expandDistance,
      },
    ])
    const nodeCenter = {
      x: (nodeBounds.minX + nodeBounds.maxX) / 2,
      y: (nodeBounds.minY + nodeBounds.maxY) / 2,
    }
    const nodeWidth = nodeBounds.maxX - nodeBounds.minX
    const nodeHeight = nodeBounds.maxY - nodeBounds.minY

    const expandedSegment = {
      segment,
      newNode: {
        capacityMeshNodeId: `new-${segment.parent.capacityMeshNodeId}-${this.expandedSegments.length}`,
        center: nodeCenter,
        width: nodeWidth,
        height: nodeHeight,
        availableZ: [segment.z],
        layer: segment.parent.layer,
      },
    }
    this.lastExpandedSegment = expandedSegment

    if (nodeWidth < EPS || nodeHeight < EPS) {
      // Node is too small, skipping
      return
    }

    this.expandedSegments.push(expandedSegment)
    this.rectSpatialIndex.insert({
      ...expandedSegment.newNode,
      ...nodeBounds,
    })
  }

  override getOutput() {
    return {
      expandedSegments: this.expandedSegments,
    }
  }

  override visualize() {
    const graphics: Required<GraphicsObject> = {
      title: "ExpandEdgesToEmptySpace",
      coordinateSystem: "cartesian" as const,
      rects: [],
      points: [],
      lines: [],
      circles: [],
      arrows: [],
      texts: [],
    }

    // Draw capacity mesh nodes with gray, faded rects
    for (const node of this.input.inputMeshNodes) {
      graphics.rects.push({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "rgba(0, 0, 0, 0.1)",
        layer: `z${node.availableZ.join(",")}`,
        label: [
          `node ${node.capacityMeshNodeId}`,
          `z:${node.availableZ.join(",")}`,
        ].join("\n"),
      })
    }

    // for (const segment of this.unprocessedSegments) {
    //   graphics.lines.push({
    //     points: [segment.start, segment.end],
    //     strokeColor: "rgba(0, 0, 255, 0.5)",
    //   })
    // }

    for (const { newNode } of this.expandedSegments) {
      graphics.rects.push({
        center: newNode.center,
        width: newNode.width,
        height: newNode.height,
        fill: "green",
        label: `expandedSegment (z=${newNode.availableZ.join(",")})`,
        layer: `z${newNode.availableZ.join(",")}`,
      })
    }

    if (this.lastSegment) {
      graphics.lines.push({
        points: [this.lastSegment.start, this.lastSegment.end],
        strokeColor: "rgba(0, 0, 255, 0.5)",
      })
    }

    if (this.lastSearchBounds) {
      graphics.rects.push({
        center: {
          x: (this.lastSearchBounds.minX + this.lastSearchBounds.maxX) / 2,
          y: (this.lastSearchBounds.minY + this.lastSearchBounds.maxY) / 2,
        },
        width: this.lastSearchBounds.maxX - this.lastSearchBounds.minX,
        height: this.lastSearchBounds.maxY - this.lastSearchBounds.minY,
        fill: "rgba(0, 0, 255, 0.25)",
      })
    }

    if (this.lastSearchCorner1 && this.lastSearchCorner2) {
      graphics.points.push({
        x: this.lastSearchCorner1.x,
        y: this.lastSearchCorner1.y,
        color: "rgba(0, 0, 255, 0.5)",
        label: ["searchCorner1", `z=${this.lastSegment?.z}`].join("\n"),
      })
      graphics.points.push({
        x: this.lastSearchCorner2.x,
        y: this.lastSearchCorner2.y,
        color: "rgba(0, 0, 255, 0.5)",
        label: ["searchCorner2", `z=${this.lastSegment?.z}`].join("\n"),
      })
    }

    if (this.lastExpandedSegment) {
      graphics.rects.push({
        center: this.lastExpandedSegment.newNode.center,
        width: this.lastExpandedSegment.newNode.width,
        height: this.lastExpandedSegment.newNode.height,
        fill: "purple",
        label: `expandedSegment (z=${this.lastExpandedSegment.segment.z})`,
      })
    }

    if (this.lastCollidingNodes) {
      for (const node of this.lastCollidingNodes) {
        graphics.rects.push({
          center: node.center,
          width: node.width,
          height: node.height,
          fill: "rgba(255, 0, 0, 0.5)",
        })
      }
    }

    return graphics
  }
}
