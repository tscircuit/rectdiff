import {
  getSvgFromGraphicsObject,
  getPngBufferFromGraphicsObject,
} from "graphics-debug"
import { FindSegmentsWithAdjacentEmptySpaceSolver } from "../lib/solvers/GapFillSolver/FindSegmentsWithAdjacentEmptySpaceSolver"
const side = 114
const nodes = Array.from({ length: side * side }, (_, i) => ({
  capacityMeshNodeId: `node_${i}`,
  center: { x: i % side, y: Math.floor(i / side) },
  width: 1,
  height: 1,
  layer: "top",
  availableZ: [0, 1],
}))
const solver = new FindSegmentsWithAdjacentEmptySpaceSolver({
  allMeshNodes: nodes,
})
solver.solve()
if (
  !solver.solved ||
  solver.failed ||
  solver.getOutput().segmentsWithAdjacentEmptySpace.length !== side * 8
)
  throw Error("Cannot publish an incomplete grid")
const graphics = solver.visualize()
graphics.title = `Completed ${side * side * 8} edges; ${side * 8} exterior segments`
await Bun.write(
  "docs/finite-gap-budget/completed.svg",
  getSvgFromGraphicsObject(graphics, { backgroundColor: "white" }),
)
await Bun.write(
  "../rectdiff-completed-edges.png",
  await getPngBufferFromGraphicsObject(graphics, {
    backgroundColor: "white",
    pngWidth: 1536,
    pngHeight: 1536,
  }),
)
