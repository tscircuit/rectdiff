#!/usr/bin/env bun

import * as readline from "node:readline"
import type {
  WorkerResult,
  WorkerResultMessage,
  WorkerTaskMessage,
} from "./benchmark-types"

const NEXT_PHASE_AFTER_PORT_POINT_PATHING = "uniformPortDistributionSolver"

const importRuntimeModule = (modulePath: string) =>
  new Function("modulePath", "return import(modulePath)")(
    modulePath,
  ) as Promise<unknown>

const createSolver = async (
  scenario: WorkerTaskMessage["task"]["scenario"],
) => {
  const solverModulePath =
    "../../../tscircuit-autorouter/lib/autorouter-pipelines/AutoroutingPipeline4_TinyHypergraph/AutoroutingPipelineSolver4_TinyHypergraph"
  const [{ RectDiffPipeline }, solverModule] = await Promise.all([
    import("../../lib/RectDiffPipeline"),
    importRuntimeModule(solverModulePath),
  ])

  const AutoroutingPipelineSolver4 = (solverModule as any)
    .AutoroutingPipelineSolver4 as new (
    srj: unknown,
    opts?: Record<string, unknown>,
  ) => {
    failed: boolean
    error: string | null
    portPointPathingSolver?: unknown
    getCurrentPhase(): string
    step(): void
  }

  return new AutoroutingPipelineSolver4(scenario, {
    overrides: {
      RectDiffPipelineClass: RectDiffPipeline,
    },
  })
}

const reader = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

reader.on("line", async (line) => {
  if (!line.trim()) {
    return
  }

  let message: WorkerTaskMessage
  try {
    message = JSON.parse(line) as WorkerTaskMessage
  } catch (error) {
    const result: WorkerResult = {
      scenarioName: "unknown",
      elapsedTimeMs: 0,
      didSolve: false,
      didTimeout: false,
      error: `Invalid worker message: ${String(error)}`,
    }
    const response: WorkerResultMessage = { result }
    process.stdout.write(`${JSON.stringify(response)}\n`)
    return
  }

  const startedAt = performance.now()

  try {
    const solver = await createSolver(message.task.scenario)

    while (
      !solver.failed &&
      solver.getCurrentPhase() !== NEXT_PHASE_AFTER_PORT_POINT_PATHING
    ) {
      solver.step()
    }

    const result: WorkerResult = {
      scenarioName: message.task.scenarioName,
      elapsedTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
      didSolve:
        !solver.failed &&
        solver.getCurrentPhase() === NEXT_PHASE_AFTER_PORT_POINT_PATHING &&
        solver.portPointPathingSolver !== undefined,
      didTimeout: false,
      error: solver.failed ? solver.error : null,
    }

    const response: WorkerResultMessage = { result }
    process.stdout.write(`${JSON.stringify(response)}\n`)
  } catch (error) {
    const result: WorkerResult = {
      scenarioName: message.task.scenarioName,
      elapsedTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
      didSolve: false,
      didTimeout: false,
      error: String(error),
    }
    const response: WorkerResultMessage = { result }
    process.stdout.write(`${JSON.stringify(response)}\n`)
  }
})
