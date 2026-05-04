/**
 * Describes the subset of solver state the benchmark worker needs.
 * This keeps the child process decoupled from internal package typings.
 */
export type BenchmarkWorkerSolver = {
  failed: boolean
  error: string | null
  portPointPathingSolver?: unknown
  getCurrentPhase(): string
  step(): void
}

/**
 * Represents the Pipeline 4 constructor shape used by the benchmark.
 * It allows the worker to inject the local RectDiff override.
 */
export type Pipeline4Constructor = new (
  srj: unknown,
  opts?: Record<string, unknown>,
) => BenchmarkWorkerSolver
