import { BaseSolver } from "@tscircuit/solver-utils"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { finalizeRects, stepExpansion } from "../rectdiff/engine"
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
    const placedCount = Math.max(1, this.rectDiffState.placed.length)
    const expansionIndex = this.rectDiffState.expansionIndex

    return Math.min(1, expansionIndex / placedCount)
  }

  override visualize(): GraphicsObject {
    return visualizeRectDiffState(this.rectDiffState, this.rectDiffState.srj)
  }

  override getOutput(): ExpansionSolverOutput {
    return {
      rectDiffState: this.rectDiffState,
      meshNodes: this.meshNodeList,
    }
  }
}
