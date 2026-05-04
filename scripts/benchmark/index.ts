#!/usr/bin/env bun

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import * as os from "node:os"
import * as path from "node:path"
import * as readline from "node:readline"
import * as dataset from "@tscircuit/autorouting-dataset-01"
import type { SimpleRouteJson } from "../../lib/types/srj-types"
import type {
  BenchmarkTask,
  WorkerResult,
  WorkerResultMessage,
  WorkerTaskMessage,
} from "./benchmark-types"

type BenchmarkOptions = {
  concurrency: number
  limit?: number
}

type WorkerSlot = {
  id: number
  child: ChildProcessWithoutNullStreams
  stdoutReader: readline.Interface
  stderrReader: readline.Interface
}

type WorkerExecutionResult = {
  result: WorkerResult
  restartWorker: boolean
}

const SAMPLE_TIMEOUT_MS = 120_000

const formatDuration = (timeMs: number | null) => {
  if (timeMs === null) {
    return "n/a"
  }
  if (timeMs < 1000) {
    return `${timeMs}ms`
  }
  return `${(timeMs / 1000).toFixed(1)}s`
}

const getPercentileMs = (
  values: number[],
  percentile: number,
): number | null => {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * percentile
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) {
    return sorted[lower] ?? null
  }

  const weight = index - lower
  const lowerValue = sorted[lower]
  const upperValue = sorted[upper]
  if (lowerValue === undefined || upperValue === undefined) {
    return null
  }
  return lowerValue + (upperValue - lowerValue) * weight
}

const parseArgs = (): BenchmarkOptions => {
  const args = process.argv.slice(2)
  const defaultConcurrency =
    typeof os.availableParallelism === "function"
      ? os.availableParallelism()
      : os.cpus().length

  const options: BenchmarkOptions = {
    concurrency: defaultConcurrency,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--concurrent") {
      options.concurrency = Number.parseInt(args[i + 1] ?? "", 10)
      i += 1
      continue
    }
    if (arg === "--limit") {
      options.limit = Number.parseInt(args[i + 1] ?? "", 10)
      i += 1
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrent must be a positive integer")
  }

  if (
    options.limit !== undefined &&
    (!Number.isFinite(options.limit) || options.limit < 1)
  ) {
    throw new Error("--limit must be a positive integer")
  }

  return options
}

const loadScenarios = (limit?: number): BenchmarkTask[] => {
  const scenarios = Object.entries(dataset)
    .map(([scenarioName, scenario]) => ({
      scenarioName,
      scenario: scenario as SimpleRouteJson,
    }))
    .sort((a, b) => a.scenarioName.localeCompare(b.scenarioName))

  if (limit === undefined) {
    return scenarios
  }

  return scenarios.slice(0, limit)
}

const createChildProcess = () =>
  spawn(
    process.execPath,
    [path.join("scripts", "benchmark", "benchmark.child.ts")],
    {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    },
  )

const createWorkerSlot = (id: number): WorkerSlot => {
  const child = createChildProcess()
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")

  return {
    id,
    child,
    stdoutReader: readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    }),
    stderrReader: readline.createInterface({
      input: child.stderr,
      crlfDelay: Infinity,
    }),
  }
}

const terminateWorker = async (slot: WorkerSlot) => {
  if (slot.child.killed || slot.child.exitCode !== null) {
    slot.stdoutReader.close()
    slot.stderrReader.close()
    return
  }

  await new Promise<void>((resolve) => {
    const finish = () => {
      slot.stdoutReader.close()
      slot.stderrReader.close()
      resolve()
    }

    slot.child.once("close", finish)
    try {
      slot.child.kill("SIGKILL")
    } catch {
      finish()
    }
  })
}

const replaceWorker = async (slot: WorkerSlot) => {
  const previousWorker: WorkerSlot = {
    id: slot.id,
    child: slot.child,
    stdoutReader: slot.stdoutReader,
    stderrReader: slot.stderrReader,
  }

  const nextWorker = createWorkerSlot(slot.id)
  slot.child = nextWorker.child
  slot.stdoutReader = nextWorker.stdoutReader
  slot.stderrReader = nextWorker.stderrReader
  await terminateWorker(previousWorker)
}

const executeTaskOnWorker = (
  slot: WorkerSlot,
  request: WorkerTaskMessage,
): Promise<WorkerExecutionResult> =>
  new Promise((resolve) => {
    const startedAt = performance.now()
    let settled = false
    let stderrOutput = ""

    const finish = (result: WorkerResult, restartWorker: boolean) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      slot.stdoutReader.removeListener("line", onLine)
      slot.stderrReader.removeListener("line", onStderrLine)
      slot.child.removeListener("error", onError)
      slot.child.removeListener("exit", onExit)
      resolve({ result, restartWorker })
    }

    const fail = (
      error: string,
      didTimeout: boolean,
      restartWorker: boolean,
    ) => {
      finish(
        {
          scenarioName: request.task.scenarioName,
          elapsedTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
          didSolve: false,
          didTimeout,
          error,
        },
        restartWorker,
      )
    }

    const onLine = (line: string) => {
      let message: WorkerResultMessage
      try {
        message = JSON.parse(line) as WorkerResultMessage
      } catch (error) {
        fail(`Failed to parse worker output: ${String(error)}`, false, true)
        return
      }

      finish(message.result, false)
    }

    const onStderrLine = (line: string) => {
      stderrOutput = stderrOutput ? `${stderrOutput}\n${line}` : line
    }

    const onError = (error: Error) => {
      fail(`Worker error: ${error.message}`, false, true)
    }

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      fail(
        stderrOutput ||
          `Worker exited before responding (code=${code}, signal=${signal})`,
        false,
        true,
      )
    }

    const timeout = setTimeout(() => {
      fail(`Timed out after ${formatDuration(SAMPLE_TIMEOUT_MS)}`, true, true)
    }, SAMPLE_TIMEOUT_MS)

    slot.stdoutReader.on("line", onLine)
    slot.stderrReader.on("line", onStderrLine)
    slot.child.once("error", onError)
    slot.child.once("exit", onExit)
    slot.child.stdin.write(`${JSON.stringify(request)}\n`)
  })

const formatTable = (
  scenarioCount: number,
  solvedCount: number,
  failedCount: number,
  timedOutCount: number,
  avgTimeMs: number,
  p50TimeMs: number | null,
  p95TimeMs: number | null,
  totalTimeMs: number,
) => {
  const headers = [
    "Solver",
    "Scenarios",
    "Solved",
    "Failed",
    "Timed Out",
    "Success %",
    "Avg Time",
    "P50 Time",
    "P95 Time",
    "Total Time",
  ]

  const rows = [
    [
      "Pipeline4->PortPointPathing",
      String(scenarioCount),
      String(solvedCount),
      String(failedCount),
      String(timedOutCount),
      `${((solvedCount / scenarioCount) * 100).toFixed(1)}%`,
      formatDuration(avgTimeMs),
      formatDuration(p50TimeMs),
      formatDuration(p95TimeMs),
      formatDuration(totalTimeMs),
    ],
  ]

  const widths = headers.map((header, columnIndex) =>
    Math.max(
      header.length,
      ...rows.map((row) => row[columnIndex]?.length ?? 0),
    ),
  )
  const paddedWidths = widths.map((width) => width ?? 0)

  const separator = `+${paddedWidths.map((width) => "-".repeat(width + 2)).join("+")}+`
  const headerLine = `| ${headers.map((header, index) => header.padEnd(paddedWidths[index] ?? header.length)).join(" | ")} |`
  const bodyLines = rows.map(
    (row) =>
      `| ${row.map((cell, index) => cell.padEnd(paddedWidths[index] ?? cell.length)).join(" | ")} |`,
  )

  return [separator, headerLine, separator, ...bodyLines, separator].join("\n")
}

const main = async () => {
  const options = parseArgs()
  const tasks = loadScenarios(options.limit)

  console.log(
    `Running ${tasks.length} dataset scenarios with concurrency ${options.concurrency}`,
  )

  const startedAt = performance.now()
  const results: WorkerResult[] = []
  const workers = Array.from(
    { length: Math.min(options.concurrency, tasks.length) },
    (_, index) => createWorkerSlot(index + 1),
  )

  let nextTaskIndex = 0

  const runWorkerLoop = async (slot: WorkerSlot) => {
    while (nextTaskIndex < tasks.length) {
      const task = tasks[nextTaskIndex]
      if (!task) {
        break
      }
      nextTaskIndex += 1

      const execution = await executeTaskOnWorker(slot, { task })
      results.push(execution.result)

      const progressLabel = `[${results.length}/${tasks.length}]`
      const status = execution.result.didSolve
        ? "solved"
        : execution.result.didTimeout
          ? "timed out"
          : "failed"
      console.log(
        `${progressLabel} ${execution.result.scenarioName} ${status} in ${formatDuration(execution.result.elapsedTimeMs)}`,
      )

      if (execution.restartWorker) {
        await replaceWorker(slot)
      }
    }
  }

  await Promise.all(workers.map((slot) => runWorkerLoop(slot)))
  await Promise.all(workers.map((slot) => terminateWorker(slot)))

  const totalTimeMs = Math.max(0, Math.round(performance.now() - startedAt))
  const solvedCount = results.filter((result) => result.didSolve).length
  const failedCount = results.length - solvedCount
  const timedOutCount = results.filter((result) => result.didTimeout).length
  const elapsedTimes = results.map((result) => result.elapsedTimeMs)
  const avgTimeMs =
    elapsedTimes.reduce((sum, value) => sum + value, 0) / elapsedTimes.length

  console.log("")
  console.log(
    formatTable(
      results.length,
      solvedCount,
      failedCount,
      timedOutCount,
      Math.round(avgTimeMs),
      getPercentileMs(elapsedTimes, 0.5),
      getPercentileMs(elapsedTimes, 0.95),
      totalTimeMs,
    ),
  )

  const failures = results.filter((result) => !result.didSolve)
  if (failures.length > 0) {
    console.log("")
    console.log("Failed scenarios:")
    for (const failure of failures.slice(0, 20)) {
      console.log(
        `- ${failure.scenarioName}: ${failure.error ?? (failure.didTimeout ? "Timed out" : "Unknown failure")}`,
      )
    }
    if (failures.length > 20) {
      console.log(`- ... and ${failures.length - 20} more`)
    }
  }
}

await main()
