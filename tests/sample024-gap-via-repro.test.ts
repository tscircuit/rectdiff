import { expect, test } from "bun:test"
import {
  getSvgFromGraphicsObject,
  type GraphicsObject,
  type Rect,
  type Text,
} from "graphics-debug"
import { GapFillSolverPipeline } from "../lib/solvers/GapFillSolver/GapFillSolverPipeline"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"
import { overlaps } from "../lib/utils/rectdiff-geometry"
import { padRect } from "../lib/utils/padRect"
import fixture from "../test-assets/sample024-mp1-gap-fill.json"

test("show the real sample024 gap beside MP1.4 and its layer connectivity", async (): Promise<void> => {
  const inputNodes: CapacityMeshNode[] = structuredClone(fixture.meshNodes)
  const solver = new GapFillSolverPipeline({
    bounds: fixture.bounds,
    boardVoid: fixture.boardVoid,
    meshNodes: inputNodes,
    maxGapFillPasses: 1,
    viaDiameter: fixture.viaDiameter,
    viaClearance: 0.15,
  })
  solver.solve()
  const radius = fixture.viaDiameter / 2
  const viaRect = {
    x: fixture.viaCenter.x - radius,
    y: fixture.viaCenter.y - radius,
    width: fixture.viaDiameter,
    height: fixture.viaDiameter,
  }
  const clearanceRect = padRect(viaRect, 0.15)
  const gapNodes = solver
    .getOutput()
    .outputNodes.filter(
      (node): boolean =>
        node.center.x - node.width / 2 <= clearanceRect.x &&
        node.center.x + node.width / 2 >=
          clearanceRect.x + clearanceRect.width &&
        node.center.y - node.height / 2 <= clearanceRect.y &&
        node.center.y + node.height / 2 >=
          clearanceRect.y + clearanceRect.height,
    )
  const fullStackNodes = gapNodes.filter(
    (node): boolean => node.availableZ.length === fixture.boardVoid.layerCount,
  )
  expect(solver.solved).toBe(true)
  expect(gapNodes.length).toBeGreaterThan(0)
  expect(fullStackNodes).toHaveLength(1)
  expect(
    [...new Set(gapNodes.flatMap((node): number[] => node.availableZ))].sort(),
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  for (const node of inputNodes.filter((node): boolean =>
    Boolean(node._containsObstacle),
  )) {
    expect(
      overlaps(clearanceRect, {
        x: node.center.x - node.width / 2,
        y: node.center.y - node.height / 2,
        width: node.width,
        height: node.height,
      }),
    ).toBe(false)
  }
  for (const outlineRect of fixture.boardVoid.boardVoidRects) {
    expect(overlaps(clearanceRect, outlineRect)).toBe(false)
  }
  const gap = gapNodes[0]!
  const graphics: GraphicsObject = {
    coordinateSystem: "cartesian",
    rects: [
      ...inputNodes.map(
        (node): Rect => ({
          center: node.center,
          width: node.width,
          height: node.height,
          fill: node._containsObstacle
            ? "rgba(255,0,0,0.2)"
            : "rgba(0,200,200,0.1)",
          stroke: node._containsObstacle ? "red" : "#888",
        }),
      ),
      {
        center: gap.center,
        width: gap.width,
        height: gap.height,
        fill: "rgba(0,100,255,0.15)",
        stroke: "blue",
      },
      ...gapNodes.map(
        (node, index): Rect => ({
          center: { x: 41, y: 44 - index * 0.8 },
          width: 9,
          height: 0.6,
          fill: "rgba(0,200,200,0.1)",
          stroke: "#666",
        }),
      ),
    ],
    circles: [
      { center: fixture.viaCenter, radius, fill: "blue", stroke: "blue" },
    ],
    texts: [
      {
        x: 17.6,
        y: 47,
        text: "sample024 / MP1.4: gap-fill layer connectivity",
        fontSize: 0.65,
        anchorSide: "bottom_left",
      },
      {
        x: 17.6,
        y: 45.8,
        text: `Via-capable regions: ${fullStackNodes.length} / Gap nodes: ${gapNodes.length}`,
        fontSize: 0.55,
        anchorSide: "bottom_left",
      },
      { x: 20.7, y: 42.4, text: "MP1.4 copper", fontSize: 0.45 },
      { x: 28.8, y: 41, text: "Existing free region", fontSize: 0.45 },
      {
        x: 17.6,
        y: 37.8,
        text: "Blue 0.3 mm via fits all 8 layers",
        fontSize: 0.45,
        anchorSide: "bottom_left",
      },
      {
        x: 36.5,
        y: 44.8,
        text: "Routing regions",
        fontSize: 0.45,
        anchorSide: "bottom_left",
      },
      ...gapNodes.map(
        (node, index): Text => ({
          x: 41,
          y: 44 - index * 0.8,
          text: `availableZ: ${node.availableZ.join(",")}`,
          fontSize: 0.4,
        }),
      ),
    ],
  }
  await expect(
    getSvgFromGraphicsObject(graphics, {
      backgroundColor: "white",
      svgWidth: 1200,
      svgHeight: 550,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
