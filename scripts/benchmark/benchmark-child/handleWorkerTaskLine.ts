import type { WorkerResult, WorkerTaskMessage } from "../benchmark-types"
import { NEXT_PHASE_AFTER_PORT_POINT_PATHING } from "./constants"
import { createSolver } from "./createSolver"
import { writeWorkerResultMessage } from "./writeWorkerResultMessage"

/**
 * Handles one benchmark request line from the parent process.
 * Each line must contain a single JSON-encoded worker task message.
 */
export const handleWorkerTaskLine = async (line: string) => {
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
    writeWorkerResultMessage(result)
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

    writeWorkerResultMessage(result)
  } catch (error) {
    const result: WorkerResult = {
      scenarioName: message.task.scenarioName,
      elapsedTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
      didSolve: false,
      didTimeout: false,
      error: String(error),
    }
    writeWorkerResultMessage(result)
  }
}
