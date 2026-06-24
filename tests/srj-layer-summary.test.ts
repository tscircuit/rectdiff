import { expect, test } from "bun:test"
import { stat } from "node:fs/promises"
import path from "node:path"
import type { SimpleRouteJson } from "lib/types/srj-types"
import { RectDiffPipeline } from "lib/RectDiffPipeline"

const srjGlobs = ["tests/**/*.json", "test-assets/*.json"]

const readSimpleRouteJson = async (
  filePath: string,
): Promise<SimpleRouteJson | null> => {
  const json = await Bun.file(filePath).json()

  if (Array.isArray(json)) {
    const first = json[0]
    return first?.simpleRouteJson ?? first?.simple_route_json ?? null
  }

  return json.simple_route_json ?? json.simpleRouteJson ?? json
}

test("solve srj files and print multi-layer node summary", async () => {
  const srjFiles: Array<{
    filePath: string
    size: number
    srj: SimpleRouteJson
  }> = []

  for (const pattern of srjGlobs) {
    for await (const filePath of new Bun.Glob(pattern).scan(".")) {
      const srj = await readSimpleRouteJson(filePath)

      if (!srj?.bounds || !srj?.connections || !srj?.obstacles) continue

      const { size } = await stat(filePath)
      srjFiles.push({ filePath, size, srj })
    }
  }

  const largestFiles = srjFiles.sort((a, b) => b.size - a.size)
  expect(largestFiles.length).toBeGreaterThan(0)

  const rows: Array<Record<string, string | number>> = []

  for (const { filePath, srj } of largestFiles) {
    const solver = new RectDiffPipeline({
      simpleRouteJson: srj,
      maxGapFillPasses: 1,
    })
    solver.solve()

    const allMeshNodes = solver.getOutput().meshNodes
    const meshNodes = allMeshNodes.filter((node) => !node._containsObstacle)
    expect(meshNodes.length).toBeGreaterThan(0)

    let totalVolume = 0
    let obstacleVolume = 0
    let multiLayerVolume = 0

    for (const node of allMeshNodes) {
      const layerSpan = node.availableZ.length
      const volume = node.width * node.height * layerSpan

      totalVolume += volume

      if (node._containsObstacle) {
        obstacleVolume += volume
      }
    }

    for (const node of meshNodes) {
      const layerSpan = node.availableZ.length
      const volume = node.width * node.height * layerSpan

      if (layerSpan >= 2) {
        multiLayerVolume += volume
      }
    }

    const usableVolume = totalVolume - obstacleVolume

    rows.push({
      file: path.basename(filePath),
      multi_volume_pct:
        usableVolume > 0
          ? `${((multiLayerVolume / usableVolume) * 100).toFixed(1)}%`
          : "0.0%",
    })
  }

  console.table(
    rows.map((row) => ({
      file: row.file,
      multi_volume_pct: row.multi_volume_pct,
    })),
  )
})
