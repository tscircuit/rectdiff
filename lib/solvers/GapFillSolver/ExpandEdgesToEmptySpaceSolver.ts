import { BaseSolver } from "@tscircuit/solver-utils"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { SegmentWithAdjacentEmptySpace } from "./FindSegmentsWithAdjacentEmptySpaceSolver"
import type { GraphicsObject } from "graphics-debug"
import RBush from "rbush"
import { EDGE_MAP, EDGES } from "./edge-constants"
import { getBoundsFromCorners } from "./getBoundsFromCorners"
import type { Bounds } from "@tscircuit/math-utils"
import { midpoint, segmentToBoxMinDistance } from "@tscircuit/math-utils"
import type { XYRect } from "../../rectdiff-types"

const EPS = 1e-4

/** Without board bounds, stop searching after this distance. */
const UNBOUNDED_SEARCH_LIMIT = 1000

/**
 * The bounded search stops once searchDistance >= boundaryDistance. A NaN
 * bound makes that comparison always false, and an infinite or reversed bound
 * describes no real board, so reject such bounds up front.
 */
const assertValidBounds = (bounds: Bounds): void => {
  const { minX, maxX, minY, maxY } = bounds
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    throw new Error(
      `ExpandEdgesToEmptySpaceSolver bounds must be finite, got ${JSON.stringify(bounds)}`,
    )
  }
  if (minX > maxX || minY > maxY) {
    throw new Error(
      `ExpandEdgesToEmptySpaceSolver bounds must satisfy minX <= maxX and minY <= maxY, got ${JSON.stringify(bounds)}`,
    )
  }
}

/**
 * Clip a seed edge to the board. Inputs may include obstacle nodes outside the
 * board or spanning its edge; only the portion inside can seed new space.
 * Returns null when the edge lies entirely outside the board.
 */
const clipSegmentToBounds = (
  segment: SegmentWithAdjacentEmptySpace,
  bounds: Bounds,
): SegmentWithAdjacentEmptySpace | null => {
  const start = { ...segment.start }
  const end = { ...segment.end }
  const isVerticalEdge = EDGE_MAP[segment.facingDirection].dx !== 0

  if (isVerticalEdge) {
    if (start.x < bounds.minX || start.x > bounds.maxX) return null
    start.y = Math.max(bounds.minY, Math.min(bounds.maxY, start.y))
    end.y = Math.max(bounds.minY, Math.min(bounds.maxY, end.y))
  } else {
    if (start.y < bounds.minY || start.y > bounds.maxY) return null
    start.x = Math.max(bounds.minX, Math.min(bounds.maxX, start.x))
    end.x = Math.max(bounds.minX, Math.min(bounds.maxX, end.x))
  }

  return { ...segment, start, end }
}

/** Distance from the edge to the board boundary in its facing direction. */
const getDistanceToBoardEdge = (
  segment: SegmentWithAdjacentEmptySpace,
  bounds: Bounds,
): number => {
  switch (segment.facingDirection) {
    case "x+":
      return bounds.maxX - segment.start.x
    case "x-":
      return segment.start.x - bounds.minX
    case "y+":
      return bounds.maxY - segment.start.y
    case "y-":
      return segment.start.y - bounds.minY
  }
}

export type ExpandEdgesToEmptySpaceSolverInput = {
  /** Optional for standalone callers; the full board pipeline always supplies it. */
  bounds?: Bounds
  inputMeshNodes: CapacityMeshNode[]
  segmentsWithAdjacentEmptySpace: Array<SegmentWithAdjacentEmptySpace>
  boardVoid?: {
    boardVoidRects: XYRect[]
    layerCount: number
  }
}

export interface ExpandedSegment {
  segment: SegmentWithAdjacentEmptySpace
  newNode: CapacityMeshNode
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

  rectSpatialIndex: RBush<CapacityMeshNode>

  constructor(private input: ExpandEdgesToEmptySpaceSolverInput) {
    super()
    if (this.input.bounds) assertValidBounds(this.input.bounds)
    this.unprocessedSegments = [...this.input.segmentsWithAdjacentEmptySpace]
    this.rectSpatialIndex = new RBush<CapacityMeshNode>()
    // create fake bound for the boardVoidRects
    this.rectSpatialIndex.load(
      this.input.boardVoid?.boardVoidRects.map((rect, index) => ({
        capacityMeshNodeId: `void-rect-${index}`,
        center: {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        },
        width: rect.width,
        height: rect.height,
        availableZ: Array.from(
          { length: this.input.boardVoid?.layerCount || 0 },
          (_, i) => i,
        ),
        layer: "void",
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width,
        maxY: rect.y + rect.height,
      })) || [],
    )
    this.rectSpatialIndex.load(
      this.input.inputMeshNodes.map((n) => ({
        ...n,
        minX: n.center.x - n.width / 2,
        minY: n.center.y - n.height / 2,
        maxX: n.center.x + n.width / 2,
        maxY: n.center.y + n.height / 2,
      })),
    )
  }

  override _step() {
    if (this.unprocessedSegments.length === 0) {
      this.solved = true
      return
    }

    const originalSegment = this.unprocessedSegments.shift()!
    this.lastSegment = originalSegment

    const bounds = this.input.bounds
    let segment = originalSegment
    if (bounds) {
      const clippedSegment = clipSegmentToBounds(originalSegment, bounds)
      if (!clippedSegment) return
      segment = clippedSegment
      // Show the edge that actually seeds the node, not the unclipped input
      this.lastSegment = clippedSegment
    }

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
    if (segLength < EPS) return
    const normDeltaStartEnd = {
      x: deltaStartEnd.x / segLength,
      y: deltaStartEnd.y / segLength,
    }

    const boundaryDistance = bounds
      ? getDistanceToBoardEdge(segment, bounds)
      : Infinity
    if (boundaryDistance < EPS) return

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
    // Grow the search geometrically until it hits a node. With bounds, the
    // final search reaches exactly the board edge; without bounds, give up
    // after UNBOUNDED_SEARCH_LIMIT.
    let collidingNodes: CapacityMeshNode[] = []
    for (
      let searchDistance = 1;
      bounds || searchDistance < UNBOUNDED_SEARCH_LIMIT;
      searchDistance *= 4
    ) {
      const clampedSearchDistance = Math.min(searchDistance, boundaryDistance)
      const searchBounds = getBoundsFromCorners([
        searchCorner1,
        searchCorner2,
        {
          x: searchCorner1.x + dx * clampedSearchDistance,
          y: searchCorner1.y + dy * clampedSearchDistance,
        },
        {
          x: searchCorner2.x + dx * clampedSearchDistance,
          y: searchCorner2.y + dy * clampedSearchDistance,
        },
      ])
      this.lastSearchBounds = searchBounds
      collidingNodes = this.rectSpatialIndex
        .search(searchBounds)
        .filter((n) => n.availableZ.includes(segment.z))
        .filter(
          (n) => n.capacityMeshNodeId !== segment.parent.capacityMeshNodeId,
        )

      if (collidingNodes.length > 0) break
      if (searchDistance >= boundaryDistance) break
    }

    // Without bounds there is no board edge to grow to, so an unobstructed
    // edge creates no node.
    if (collidingNodes.length === 0 && !bounds) return
    this.lastCollidingNodes = collidingNodes

    // Grow up to the nearest colliding node, or to the board edge if none
    let smallestDistance = boundaryDistance
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
      infiniteLines: [],
      polygons: [],
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
