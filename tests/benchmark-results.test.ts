import { expect, test } from "bun:test"

test("benchmark prints result output for one scenario", async () => {
  const benchmarkProcess = Bun.spawn({
    cmd: [
      process.execPath,
      "scripts/benchmark/index.ts",
      "--limit",
      "1",
      "--concurrent",
      "1",
    ],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })

  const [exitCode, stdout, stderr] = await Promise.all([
    benchmarkProcess.exited,
    new Response(benchmarkProcess.stdout).text(),
    new Response(benchmarkProcess.stderr).text(),
  ])

  expect(stderr).toBe("")
  expect(exitCode).toBe(0)
  expect(stdout).toContain("Running 1 dataset scenarios with concurrency 1")
  expect(stdout).toContain("[1/1]")
  expect(stdout).toContain("Pipeline4->PortPointPathing")
}, 180_000)
