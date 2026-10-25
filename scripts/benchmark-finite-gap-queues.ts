import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
const repo = resolve(Bun.argv[2] ?? ".")
const { FindSegmentsWithAdjacentEmptySpaceSolver } = await import(
  pathToFileURL(
    resolve(
      repo,
      "lib/solvers/GapFillSolver/FindSegmentsWithAdjacentEmptySpaceSolver.ts",
    ),
  ).href
)
const { ExpandEdgesToEmptySpaceSolver } = await import(
  pathToFileURL(
    resolve(repo, "lib/solvers/GapFillSolver/ExpandEdgesToEmptySpaceSolver.ts"),
  ).href
)
const side = 114,
  nodes = Array.from({ length: side * side }, (_, i) => ({
    capacityMeshNodeId: `node_${i}`,
    center: { x: i % side, y: Math.floor(i / side) },
    width: 1,
    height: 1,
    layer: "top",
    availableZ: [0, 1],
  }))
const parent = {
  capacityMeshNodeId: "boundary",
  center: { x: 0, y: 0 },
  width: 1,
  height: 1,
  layer: "top",
  availableZ: [0],
}
const count = 100001,
  segments = Array.from({ length: count }, (_, i) => ({
    parent,
    start: { x: 0.5, y: -0.5 + i / count },
    end: { x: 0.5, y: -0.5 + (i + 1) / count },
    z: 0,
    facingDirection: "x+",
  }))
const find = new FindSegmentsWithAdjacentEmptySpaceSolver({
    allMeshNodes: nodes,
  }),
  expand = new ExpandEdgesToEmptySpaceSolver({
    bounds: { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 },
    inputMeshNodes: [parent],
    segmentsWithAdjacentEmptySpace: segments,
  })
const rows = []
for (const [name, solver, items] of [
  ["find", find, side * side * 8],
  ["expand", expand, count],
] as const) {
  const start = performance.now()
  solver.solve()
  rows.push({
    name,
    items,
    iterations: solver.iterations,
    solved: solver.solved,
    failed: solver.failed,
    error: solver.error,
    seconds: (performance.now() - start) / 1000,
    remaining:
      name === "find"
        ? solver.unprocessedEdges.length
        : solver.unprocessedSegments.length,
  })
}
const report = {
  runtime: Bun.version,
  revision: Bun.spawnSync(["git", "-C", repo, "rev-parse", "HEAD"])
    .stdout.toString()
    .trim(),
  rows,
}
await Bun.write(
  Bun.argv[3] ?? "finite-gap-report.json",
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report))
