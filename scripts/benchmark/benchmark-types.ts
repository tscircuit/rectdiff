import type { SimpleRouteJson } from "../../lib/types/srj-types"

export type BenchmarkTask = {
  scenarioName: string
  scenario: SimpleRouteJson
}

export type WorkerTaskMessage = {
  task: BenchmarkTask
}

export type WorkerResult = {
  scenarioName: string
  elapsedTimeMs: number
  didSolve: boolean
  didTimeout: boolean
  error: string | null
}

export type WorkerResultMessage = {
  result: WorkerResult
}
