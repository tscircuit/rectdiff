import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"

export class RectDiffSolver extends BaseSolver {
  constructor(params: { simpleRouteJson: SimpleRouteJson }) {
    super()
  }

  _step() {
    // TODO
  }

  override visualize(): GraphicsObject {
    // TODO
  }
}
