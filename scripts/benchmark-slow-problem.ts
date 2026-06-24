import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import type { SimpleRouteJson } from "../lib/types/srj-types"

type BenchmarkInput = {
  simpleRouteJson: SimpleRouteJson
}

const args = Bun.argv.slice(2)
const filePath = args[0] ?? "test-assets/keyboard4.json"
const repeatArg = args.find((arg) => arg.startsWith("--repeat="))
const repeatCount = repeatArg
  ? Number.parseInt(repeatArg.split("=")[1]!, 10)
  : 5

const data = JSON.parse(await Bun.file(filePath).text()) as
  | BenchmarkInput
  | BenchmarkInput[]
const input = Array.isArray(data) ? data[0] : data

if (!input?.simpleRouteJson) {
  throw new Error(`Expected ${filePath} to contain { simpleRouteJson } input`)
}

const areaScore = (
  meshNodes: ReturnType<RectDiffPipeline["getOutput"]>["meshNodes"],
) =>
  meshNodes.reduce(
    (sum, node) =>
      sum + node.width * node.height * (node.availableZ?.length ?? 1),
    0,
  )

const runs: Array<{
  totalMs: number
  gridMs: number
  gapFillMs: number
  nodeCount: number
  area: number
}> = []

for (let i = 0; i < repeatCount; i++) {
  const solver = new RectDiffPipeline({ ...input, maxGapFillPasses: 1 })
  const t0 = performance.now()
  solver.solve()
  const t1 = performance.now()
  const meshNodes = solver.getOutput().meshNodes
  const stages = solver.getStageStats()
  runs.push({
    totalMs: t1 - t0,
    gridMs: stages.rectDiffGridSolverPipeline?.timeSpent ?? 0,
    gapFillMs: stages.gapFillSolver?.timeSpent ?? 0,
    nodeCount: meshNodes.length,
    area: areaScore(meshNodes),
  })
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

console.log(
  JSON.stringify(
    {
      filePath,
      repeatCount,
      obstacleCount: input.simpleRouteJson.obstacles?.length ?? 0,
      connectionCount: input.simpleRouteJson.connections?.length ?? 0,
      averages: {
        totalMs: Number.parseFloat(
          mean(runs.map((run) => run.totalMs)).toFixed(2),
        ),
        gridMs: Number.parseFloat(
          mean(runs.map((run) => run.gridMs)).toFixed(2),
        ),
        gapFillMs: Number.parseFloat(
          mean(runs.map((run) => run.gapFillMs)).toFixed(2),
        ),
        nodeCount: Number.parseFloat(
          mean(runs.map((run) => run.nodeCount)).toFixed(2),
        ),
        area: Number.parseFloat(mean(runs.map((run) => run.area)).toFixed(2)),
      },
      runs: runs.map((run, index) => ({
        run: index + 1,
        totalMs: Number.parseFloat(run.totalMs.toFixed(2)),
        gridMs: Number.parseFloat(run.gridMs.toFixed(2)),
        gapFillMs: Number.parseFloat(run.gapFillMs.toFixed(2)),
        nodeCount: run.nodeCount,
        area: Number.parseFloat(run.area.toFixed(2)),
      })),
    },
    null,
    2,
  ),
)
