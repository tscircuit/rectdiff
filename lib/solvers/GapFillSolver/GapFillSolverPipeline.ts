import {
  BasePipelineSolver,
  definePipelineStep,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { GraphicsObject } from "graphics-debug"
import { FindSegmentsWithAdjacentEmptySpaceSolver } from "./FindSegmentsWithAdjacentEmptySpaceSolver"
import {
  ExpandEdgesToEmptySpaceSolver,
  type ExpandedSegment,
} from "./ExpandEdgesToEmptySpaceSolver"
import type { XYRect } from "../../rectdiff-types"

type GapFillSolverInput = {
  meshNodes: CapacityMeshNode[]
  boardVoid?: {
    boardVoidRects: XYRect[]
    layerCount: number
  }
  /**
   * Maximum number of expansion passes to run. A pass finds exposed mesh edges,
   * expands them into adjacent empty board space, and appends those nodes before
   * the next pass starts. Higher values allow recursive gap filling from newly
   * expanded nodes; values below 1 are clamped to 1.
   */
  maxGapFillPasses: number
}

type GapFillOutput = {
  outputNodes: CapacityMeshNode[]
}

type GapFillPipelineStep = PipelineStep<
  FindSegmentsWithAdjacentEmptySpaceSolver | ExpandEdgesToEmptySpaceSolver
>

export class GapFillSolverPipeline extends BasePipelineSolver<GapFillSolverInput> {
  findSegmentsWithAdjacentEmptySpaceSolver?: FindSegmentsWithAdjacentEmptySpaceSolver
  expandEdgesToEmptySpaceSolver?: ExpandEdgesToEmptySpaceSolver
  outputNodes: CapacityMeshNode[] = []
  passExpandedCounts: number[] = []
  private currentPassNodes: CapacityMeshNode[] = []
  private currentCandidateNodes: CapacityMeshNode[] = []
  private currentPassIndex: number = 0
  private readonly expandedNodeIds: Set<string> = new Set()
  private maxGapFillPasses: number = 1

  override pipelineDef: GapFillPipelineStep[] = [
    definePipelineStep(
      "findSegmentsWithAdjacentEmptySpaceSolver",
      FindSegmentsWithAdjacentEmptySpaceSolver,
      (gapFillPipeline: GapFillSolverPipeline) => [
        {
          meshNodes: gapFillPipeline.currentPassNodes,
          candidateMeshNodes: gapFillPipeline.currentCandidateNodes,
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
          inputMeshNodes: gapFillPipeline.currentPassNodes,
          segmentsWithAdjacentEmptySpace:
            gapFillPipeline.findSegmentsWithAdjacentEmptySpaceSolver!.getOutput()
              .segmentsWithAdjacentEmptySpace,
          boardVoid: gapFillPipeline.inputProblem.boardVoid,
        },
      ],
      {
        onSolved: (gapFillPipeline: GapFillSolverPipeline): void => {
          gapFillPipeline.completePass()
        },
      },
    ),
  ] as const

  override _setup(): void {
    this.outputNodes = [...this.inputProblem.meshNodes]
    this.currentPassNodes = [...this.inputProblem.meshNodes]
    this.currentCandidateNodes = [...this.inputProblem.meshNodes]
    this.passExpandedCounts = []
    this.currentPassIndex = 0
    this.expandedNodeIds.clear()
    const maxGapFillPasses = this.inputProblem.maxGapFillPasses
    this.maxGapFillPasses = Number.isFinite(maxGapFillPasses)
      ? Math.max(1, Math.floor(maxGapFillPasses))
      : 1
  }

  private completePass(): void {
    const expandedSegments: ExpandedSegment[] =
      this.expandEdgesToEmptySpaceSolver?.getOutput().expandedSegments ?? []
    const expandedNodes: CapacityMeshNode[] = expandedSegments.map(
      (es: ExpandedSegment): CapacityMeshNode => es.newNode,
    )
    for (const node of expandedNodes) {
      this.expandedNodeIds.add(node.capacityMeshNodeId)
    }

    this.passExpandedCounts.push(expandedNodes.length)
    this.currentPassNodes = [...this.currentPassNodes, ...expandedNodes]
    this.currentCandidateNodes = expandedNodes
    this.outputNodes = this.currentPassNodes

    if (
      expandedNodes.length === 0 ||
      this.currentPassIndex + 1 >= this.maxGapFillPasses
    ) {
      return
    }

    this.currentPassIndex += 1
    this.currentPipelineStageIndex = -1
  }

  override getOutput(): GapFillOutput {
    return {
      outputNodes: this.outputNodes.length
        ? this.outputNodes
        : this.inputProblem.meshNodes,
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
      infiniteLines: [],
      polygons: [],
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
      infiniteLines: [],
      polygons: [],
      arrows: [],
      texts: [],
    }

    const { outputNodes } = this.getOutput()

    for (const node of outputNodes) {
      const isExpanded = this.expandedNodeIds.has(node.capacityMeshNodeId)
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
