// lib/solvers/rectdiff/edge-expansion-gapfill/calculatePotentialArea.ts
import type { GapFillNode, Direction, EdgeExpansionGapFillState } from "./types"
import { calculateAvailableSpace } from "./calculateAvailableSpace"

export function calculatePotentialArea(
  params: { node: GapFillNode; direction: Direction },
  ctx: EdgeExpansionGapFillState,
): number {
  const { node, direction } = params
  const available = calculateAvailableSpace({ node, direction }, ctx)

  if (direction === "up" || direction === "down") {
    return available * node.rect.width
  } else {
    return available * node.rect.height
  }
}
