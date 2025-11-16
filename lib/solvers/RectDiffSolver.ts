import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"

export class RectDiffSolver extends BaseSolver {
  constructor(params: { simpleRouteJson: SimpleRouteJson }) {
    super()
  }

  override _step(): void {
    // TODO
    // Notes:
    // - Only perform one operation per step, this makes it easier to debug
    // - Often, unrolling a for loop is a good way to make a step function
    // - When finished, mark this.solved = true
    // - If failed, mark this.failed = true, and set this this.errorMessage = "..."
    // - this.iterations automatically increments (managed by the base class)
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    // TODO
  }

  override visualize(): GraphicsObject {
    // TODO
  }
}
