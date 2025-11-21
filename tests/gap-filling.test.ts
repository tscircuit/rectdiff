import { expect, test } from "bun:test"
import { RectDiffSolver } from "../lib/solvers/RectDiffSolver"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { getSvgFromGraphicsObject } from "graphics-debug"

test("gap-filling adjusts adjacent nodes to fill small gaps", () => {
  // Create a scenario with two obstacles that force nodes to be created
  // with a small gap between them
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 10,
      minY: 0,
      maxY: 10,
    },
    obstacles: [
      // Left obstacle
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2, y: 5 },
        width: 2,
        height: 8,
        connectedTo: [],
      },
      // Right obstacle
      {
        type: "rect",
        layers: ["top"],
        center: { x: 8, y: 5 },
        width: 2,
        height: 8,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 2,
    minTraceWidth: 0.15,
  }

  const solver = new RectDiffSolver({
    simpleRouteJson,
    mode: "grid",
    gridOptions: {
      minSingle: { width: 0.3, height: 0.3 },
      minMulti: { width: 0.6, height: 0.6, minLayers: 2 },
      preferMultiLayer: true,
    },
  })

  solver.solve()

  const output = solver.getOutput()

  // Should have created some mesh nodes
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // Check if there are adjacent nodes (nodes close to each other)
  const nodes = output.meshNodes
  let foundAdjacentPair = false
  let minGap = Infinity

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i]!
      const n2 = nodes[j]!

      // Check horizontal adjacency
      const n1Right = n1.center.x + n1.width / 2
      const n2Left = n2.center.x - n2.width / 2
      const hGap = Math.abs(n2Left - n1Right)

      const n1Top = n1.center.y - n1.height / 2
      const n1Bottom = n1.center.y + n1.height / 2
      const n2Top = n2.center.y - n2.height / 2
      const n2Bottom = n2.center.y + n2.height / 2

      const vOverlap = Math.min(n1Bottom, n2Bottom) - Math.max(n1Top, n2Top)

      if (vOverlap > 0 && hGap < 0.5) {
        foundAdjacentPair = true
        minGap = Math.min(minGap, hGap)
      }

      // Check vertical adjacency
      const n1Left = n1.center.x - n1.width / 2
      const n1RightPos = n1.center.x + n1.width / 2
      const n2LeftPos = n2.center.x - n2.width / 2
      const n2RightPos = n2.center.x + n2.width / 2

      const hOverlap =
        Math.min(n1RightPos, n2RightPos) - Math.max(n1Left, n2LeftPos)

      const n1BottomPos = n1.center.y + n1.height / 2
      const n2TopPos = n2.center.y - n2.height / 2
      const vGap = Math.abs(n2TopPos - n1BottomPos)

      if (hOverlap > 0 && vGap < 0.5) {
        foundAdjacentPair = true
        minGap = Math.min(minGap, vGap)
      }
    }
  }

  // If adjacent pairs exist, the gap should be very small (gap-filling should work)
  if (foundAdjacentPair) {
    // Gap should be smaller than minTraceWidth (0.15) since gap-filling occurred
    expect(minGap).toBeLessThan(0.2)
  }

  // All nodes should meet minimum requirements
  for (const node of output.meshNodes) {
    expect(node.width).toBeGreaterThan(0)
    expect(node.height).toBeGreaterThan(0)
  }
})

test("gap-filling visual snapshot", async () => {
  // Create a simple scenario to visualize gap-filling
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 15,
      minY: 0,
      maxY: 10,
    },
    obstacles: [
      // Create obstacles that will result in adjacent nodes with gaps
      {
        type: "rect",
        layers: ["top"],
        center: { x: 3, y: 5 },
        width: 2,
        height: 6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 12, y: 5 },
        width: 2,
        height: 6,
        connectedTo: [],
      },
      // Add some smaller obstacles to create interesting gaps
      {
        type: "rect",
        layers: ["top"],
        center: { x: 7.5, y: 2 },
        width: 1,
        height: 1,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 7.5, y: 8 },
        width: 1,
        height: 1,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 2,
    minTraceWidth: 0.15,
  }

  const solver = new RectDiffSolver({
    simpleRouteJson,
    mode: "grid",
    gridOptions: {
      minSingle: { width: 0.3, height: 0.3 },
      minMulti: { width: 0.6, height: 0.6, minLayers: 2 },
      preferMultiLayer: true,
    },
  })

  solver.solve()

  const output = solver.getOutput()

  // Create a visualization
  const graphicsObjects: any[] = []

  // Draw bounds
  graphicsObjects.push({
    type: "rect",
    x: simpleRouteJson.bounds.minX,
    y: simpleRouteJson.bounds.minY,
    width: simpleRouteJson.bounds.maxX - simpleRouteJson.bounds.minX,
    height: simpleRouteJson.bounds.maxY - simpleRouteJson.bounds.minY,
    stroke: "black",
    strokeWidth: 0.05,
    fill: "none",
  })

  // Draw obstacles
  for (const obstacle of simpleRouteJson.obstacles) {
    graphicsObjects.push({
      type: "rect",
      x: obstacle.center.x - obstacle.width / 2,
      y: obstacle.center.y - obstacle.height / 2,
      width: obstacle.width,
      height: obstacle.height,
      fill: "#ff0000",
      fillOpacity: 0.3,
      stroke: "#ff0000",
      strokeWidth: 0.02,
    })
  }

  // Draw mesh nodes
  for (const node of output.meshNodes) {
    const isMultiLayer = (node.availableZ?.length ?? 0) > 1
    const color = isMultiLayer ? "#0066cc" : "#66cc00"

    graphicsObjects.push({
      type: "rect",
      x: node.center.x - node.width / 2,
      y: node.center.y - node.height / 2,
      width: node.width,
      height: node.height,
      fill: color,
      fillOpacity: 0.4,
      stroke: color,
      strokeWidth: 0.02,
    })
  }

  const svg = getSvgFromGraphicsObject({
    type: "group",
    children: graphicsObjects,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
