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

const normalize = (n: any) => ({
  x: Number(n.center.x.toFixed(6)),
  y: Number(n.center.y.toFixed(6)),
  w: Number(n.width.toFixed(6)),
  h: Number(n.height.toFixed(6)),
  z: [...n.availableZ].sort((a: number, b: number) => a - b).join(","),
})

const key = (nn: ReturnType<typeof normalize>) =>
  `${nn.x}|${nn.y}|${nn.w}|${nn.h}|${nn.z}`

const buildNodesOnlyGraphic = (nodes: any[]): GraphicsObject => ({
  title: "nodes-only",
  coordinateSystem: "cartesian",
  rects: nodes.map((node) => ({
    center: node.center,
    width: node.width,
    height: node.height,
    stroke: getColorForZLayer(node.availableZ).stroke,
    fill: getColorForZLayer(node.availableZ).fill,
    layer: `z${node.availableZ.join(",")}`,
  })),
  lines: [],
  points: [],
})

test("clearance-param vs padded-obstacles produce identical mesh and SVG", async () => {
  const solverA = new RectDiffPipeline({
    simpleRouteJson: srj,
    obstacleClearance: OBSTACLE_CLEARANCE,
  })
  solverA.solve()
  const outA = solverA.getOutput().meshNodes

  const paddedSrj = padSrjObstacles(srj, OBSTACLE_CLEARANCE)
  const solverB = new RectDiffPipeline({
    simpleRouteJson: paddedSrj,
    obstacleClearance: 0,
  })
  solverB.solve()
  const outB = solverB.getOutput().meshNodes

  const normA = outA.map(normalize).sort((a, b) => key(a).localeCompare(key(b)))
  const normB = outB.map(normalize).sort((a, b) => key(a).localeCompare(key(b)))

  expect(normA.length).toBe(normB.length)
  for (let i = 0; i < normA.length; i++) expect(key(normA[i]!)).toBe(key(normB[i]!))

  const svgA = getSvgFromGraphicsObject(
    buildNodesOnlyGraphic(outA),
    { svgWidth: 640, svgHeight: 640 },
  )
  const svgB = getSvgFromGraphicsObject(
    buildNodesOnlyGraphic(outB),
    { svgWidth: 640, svgHeight: 640 },
  )

  expect(svgA).toBe(svgB)
})
