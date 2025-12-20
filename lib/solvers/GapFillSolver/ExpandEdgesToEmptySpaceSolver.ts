import { BaseSolver } from "@tscircuit/solver-utils"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { SegmentWithAdjacentEmptySpace } from "./FindSegmentsWithAdjacentEmptySpaceSolver"
import type { GraphicsObject } from "graphics-debug"

export class ExpandEdgesToEmptySpaceSolver extends BaseSolver {
  unprocessedSegments: Array<SegmentWithAdjacentEmptySpace> = []
  expandedSegments: Array<{
    segment: SegmentWithAdjacentEmptySpace
    newNode: CapacityMeshNode
  }> = []

  lastSegment: SegmentWithAdjacentEmptySpace | null = null

  constructor(
    private input: {
      inputMeshNodes: CapacityMeshNode[]
      segmentsWithAdjacentEmptySpace: Array<SegmentWithAdjacentEmptySpace>
    },
  ) {
    super()
    this.unprocessedSegments = [...this.input.segmentsWithAdjacentEmptySpace]
  }

  override _step() {
    if (this.unprocessedSegments.length === 0) {
      this.solved = true
      return
    }

    const segment = this.unprocessedSegments.shift()!
    this.lastSegment = segment

    this.expandedSegments.push({
      segment,
      newNode: this.input.inputMeshNodes.find((n) =>
        n.availableZ.includes(segment.z),
      )!,
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

    for (const segment of this.unprocessedSegments) {
      graphics.lines.push({
        points: [segment.start, segment.end],
        strokeColor: "rgba(0, 0, 255, 0.5)",
      })
    }

    for (const segment of this.expandedSegments) {
      graphics.lines.push({
        points: [segment.segment.start, segment.segment.end],
        strokeColor: "rgba(0, 255, 0, 0.5)",
      })
    }

    if (this.lastSegment) {
      graphics.lines.push({
        points: [this.lastSegment.start, this.lastSegment.end],
        strokeColor: "rgba(0, 0, 255, 0.5)",
      })
    }

    return graphics
  }
}
