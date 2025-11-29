// lib/solvers/rectdiff/gapfill/engine/addPlacement.ts
import type { Placed3D, XYRect } from "../../types"
import type { GapFillState } from "../types"

/**
 * Add a new placement to the state.
 */
export function addPlacement(
  state: GapFillState,
  {
    rect,
    zLayers,
  }: {
    rect: XYRect
    zLayers: number[]
  },
): void {
  const placed: Placed3D = { rect, zLayers: [...zLayers] }
  state.placed.push(placed)

  for (const z of zLayers) {
    if (!state.placedByLayer[z]) {
      state.placedByLayer[z] = []
    }
    state.placedByLayer[z]!.push(rect)
  }
}
