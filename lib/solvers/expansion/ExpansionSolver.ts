import { BaseSolver } from "@tscircuit/solver-utils"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import {
  computeProgress,
  finalizeRects,
  stepExpansion,
} from "../rectdiff/engine"
import type { Rect3d, RectDiffState } from "../rectdiff/types"
import { rectsToMeshNodes } from "../rectdiff/rectsToMeshNodes"
import type { GraphicsObject } from "graphics-debug"
import { visualizeRectDiffState } from "../rectdiff/visualizeRectDiffState"

export type ExpansionSolverInput = {
  initialState: RectDiffState
}

export type ExpansionSolverOutput = {
  rectDiffState: RectDiffState
  meshNodes: CapacityMeshNode[]
}

export class ExpansionSolver extends BaseSolver {
  private rectDiffState!: RectDiffState
  private meshNodeList: CapacityMeshNode[] = []

  constructor(private rectDiffExpansionInput: ExpansionSolverInput) {
    super()
  }

  override _setup() {
    this.rectDiffState = this.rectDiffExpansionInput.initialState
    this.stats = {
      expansionIndex: this.rectDiffState.expansionIndex,
    }
  }

  override _step() {
    if (this.rectDiffState.expansionIndex >= this.rectDiffState.placed.length) {
      if (this.meshNodeList.length === 0) {
        this.finalizeMeshNodes()
      }
      this.solved = true
      return
    }

    stepExpansion(this.rectDiffState)

    this.stats.expansionIndex = this.rectDiffState.expansionIndex
    this.stats.placed = this.rectDiffState.placed.length
  }

  private finalizeMeshNodes() {
    const rectList: Rect3d[] = finalizeRects(this.rectDiffState)
    this.meshNodeList = rectsToMeshNodes(rectList)
  }

  computeProgress(): number {
    return computeProgress(this.rectDiffState)
  }

  override visualize(): GraphicsObject {
    return visualizeRectDiffState(this.rectDiffState, {
      bounds: this.rectDiffState.srj.bounds,
      obstacles: this.rectDiffState.srj.obstacles,
      connections: this.rectDiffState.srj.connections,
      layerCount: this.rectDiffState.srj.layerCount,
      minTraceWidth: this.rectDiffState.srj.minTraceWidth,
      outline: this.rectDiffState.srj.outline,
    } as any)
  }

  override getOutput(): ExpansionSolverOutput {
    return {
      rectDiffState: this.rectDiffState,
      meshNodes: this.meshNodeList,
    }
  }
}
