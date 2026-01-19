import { expect, test } from "bun:test"
import srj_json from "./bugreport11-b2de3c.json"
import { RectDiffPipeline } from "lib/RectDiffPipeline"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"

const srj = srj_json.simple_route_json ?? srj_json.simpleRouteJson ?? srj_json
const OBSTACLE_CLEARANCE = 0.015

const padSrjObstacles = (input: any, padding: number) => {
  const copy = JSON.parse(JSON.stringify(input))
  for (const o of copy.obstacles ?? []) {
    if (!o || (o.type !== "rect" && o.type !== "oval")) continue
    if (typeof o.width === "number") o.width += 2 * padding
    if (typeof o.height === "number") o.height += 2 * padding
    if (typeof o.radius === "number") o.radius += padding
    if (typeof o.rx === "number") o.rx += padding
    if (typeof o.ry === "number") o.ry += padding
  }
  return copy
}

const getTotalCapacity = (nodes: any[]): number =>
  nodes.reduce((sum, n) => sum + n.width * n.height, 0)

test("clearance-param vs padded-obstacles produce equivalent free space capacity", async () => {
  const solverA = new RectDiffPipeline({
    simpleRouteJson: srj,
    obstacleClearance: OBSTACLE_CLEARANCE,
  })
  solverA.solve()
  const outA = solverA.getOutput().meshNodes.filter((n) => !n._containsObstacle)

  const paddedSrj = padSrjObstacles(srj, OBSTACLE_CLEARANCE)
  const solverB = new RectDiffPipeline({
    simpleRouteJson: paddedSrj,
    obstacleClearance: 0,
  })
  solverB.solve()
  const outB = solverB.getOutput().meshNodes.filter((n) => !n._containsObstacle)

  const capA = getTotalCapacity(outA)
  const capB = getTotalCapacity(outB)

  console.log(`capacity A: ${capA.toFixed(6)}, capacity B: ${capB.toFixed(6)}, diff: ${Math.abs(capA - capB).toFixed(10)}`)
  console.log(`node count A: ${outA.length}, node count B: ${outB.length}`)

  const tolerance = 1e-6
  expect(Math.abs(capA - capB)).toBeLessThan(tolerance)
})

