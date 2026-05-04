import type { SimpleRouteJson } from "../../lib/types/srj-types"

/**
 * Defines one benchmark scenario loaded from the dataset package.
 */
export type BenchmarkTask = {
  scenarioName: string
  scenario: SimpleRouteJson
}

/**
 * Wraps a benchmark task for line-delimited worker communication.
 */
export type WorkerTaskMessage = {
  task: BenchmarkTask
}

/**
 * Captures the outcome of a single benchmark worker run.
 */
export type WorkerResult = {
  scenarioName: string
  elapsedTimeMs: number
  didSolve: boolean
  didTimeout: boolean
  error: string | null
}

/**
 * Wraps a worker result for line-delimited stdout transport.
 */
export type WorkerResultMessage = {
  result: WorkerResult
}
