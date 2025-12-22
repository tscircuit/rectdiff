import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "lib/types/srj-types"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { FindSegmentsWithAdjacentEmptySpaceSolver } from "./FindSegmentsWithAdjacentEmptySpaceSolver"
import { ExpandEdgesToEmptySpaceSolver } from "./ExpandEdgesToEmptySpaceSolver"

export class GapFillSolverPipeline extends BasePipelineSolver<{
  meshNodes: CapacityMeshNode[]
}> {
  findSegmentsWithAdjacentEmptySpaceSolver?: FindSegmentsWithAdjacentEmptySpaceSolver
  expandEdgesToEmptySpaceSolver?: ExpandEdgesToEmptySpaceSolver

  override pipelineDef: PipelineStep<any>[] = [
    definePipelineStep(
      "findSegmentsWithAdjacentEmptySpaceSolver",
      FindSegmentsWithAdjacentEmptySpaceSolver,
      (gapFillPipeline) => [
        {
          meshNodes: gapFillPipeline.inputProblem.meshNodes,
        },
      ],
      {
        onSolved: () => {
          // Gap fill solver completed
        },
      },
    ),
    definePipelineStep(
      "expandEdgesToEmptySpaceSolver",
      ExpandEdgesToEmptySpaceSolver,
      (gapFillPipeline: GapFillSolverPipeline) => [
        {
          inputMeshNodes: gapFillPipeline.inputProblem.meshNodes,
          segmentsWithAdjacentEmptySpace:
            gapFillPipeline.findSegmentsWithAdjacentEmptySpaceSolver!.getOutput()
              .segmentsWithAdjacentEmptySpace,
        },
      ],
      {
        onSolved: () => {
          // Gap fill solver completed
        },
      },
    ),
  ] as const

  override getOutput(): { outputNodes: CapacityMeshNode[] } {
    const expandedSegments =
      this.expandEdgesToEmptySpaceSolver?.getOutput().expandedSegments ?? []
    const expandedNodes = expandedSegments.map((es) => es.newNode)

    return {
      outputNodes: [...this.inputProblem.meshNodes, ...expandedNodes],
    }
  }

  override initialVisualize(): GraphicsObject {
    const graphics: Required<GraphicsObject> = {
      title: "GapFillSolverPipeline - Initial",
      coordinateSystem: "cartesian" as const,
      rects: [],
      points: [],
      lines: [],
      circles: [],
      arrows: [],
      texts: [],
    }

    for (const node of this.inputProblem.meshNodes) {
      graphics.rects.push({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: "rgba(0, 0, 0, 0.3)",
        fill: "rgba(100, 100, 100, 0.1)",
        layer: `z${node.availableZ.join(",")}`,
        label: [
          `node ${node.capacityMeshNodeId}`,
          `z:${node.availableZ.join(",")}`,
        ].join("\n"),
      })
    }

    return graphics
  }

  override finalVisualize(): GraphicsObject {
    const graphics: Required<GraphicsObject> = {
      title: "GapFillSolverPipeline - Final",
      coordinateSystem: "cartesian" as const,
      rects: [],
      points: [],
      lines: [],
      circles: [],
      arrows: [],
      texts: [],
    }

    const { outputNodes } = this.getOutput()
    const expandedSegments =
      this.expandEdgesToEmptySpaceSolver?.getOutput().expandedSegments ?? []
    const expandedNodeIds = new Set(
      expandedSegments.map((es) => es.newNode.capacityMeshNodeId),
    )

    for (const node of outputNodes) {
      const isExpanded = expandedNodeIds.has(node.capacityMeshNodeId)
      graphics.rects.push({
        center: node.center,
        width: node.width,
        height: node.height,
        stroke: isExpanded ? "rgba(0, 128, 0, 0.8)" : "rgba(0, 0, 0, 0.3)",
        fill: isExpanded ? "rgba(0, 200, 0, 0.3)" : "rgba(100, 100, 100, 0.1)",
        layer: `z${node.availableZ.join(",")}`,
        label: [
          `${isExpanded ? "[expanded] " : ""}node ${node.capacityMeshNodeId}`,
          `z:${node.availableZ.join(",")}`,
        ].join("\n"),
      })
    }

    return graphics
  }
}
