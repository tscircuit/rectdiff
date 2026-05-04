import type { WorkerResult, WorkerResultMessage } from "../benchmark-types"

/**
 * Writes a worker result message as a single JSON line.
 * The parent benchmark process reads these messages over stdout.
 */
export const writeWorkerResultMessage = (result: WorkerResult) => {
  const response: WorkerResultMessage = { result }
  process.stdout.write(`${JSON.stringify(response)}\n`)
}
