import { expect, test } from "bun:test"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import type { SimpleRouteJson } from "../lib/types/srj-types"

test("RectDiffSolver creates mesh nodes with grid-based approach", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 10,
      minY: 0,
      maxY: 10,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.5, y: 2.5 },
        width: 2,
        height: 2,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 2,
    minTraceWidth: 0.15,
  }

  const solver = new RectDiffPipeline({
    simpleRouteJson,
  })

  solver.solve()

  const output = solver.getOutput()

  // Should have created some mesh nodes
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // All mesh nodes should have valid dimensions
  for (const node of output.meshNodes) {
    expect(node.width).toBeGreaterThan(0)
    expect(node.height).toBeGreaterThan(0)
    expect(node.availableZ).toBeDefined()
    expect(Array.isArray(node.availableZ)).toBe(true)
  }
})

test("RectDiffSolver handles multi-layer spans", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 10,
      minY: 0,
      maxY: 10,
    },
    obstacles: [],
    connections: [],
    layerCount: 3,
    minTraceWidth: 0.2,
  }

  const solver = new RectDiffPipeline({
    simpleRouteJson,
    gridOptions: {
      minSingle: { width: 0.4, height: 0.4 },
      minMulti: { width: 1.0, height: 1.0, minLayers: 2 },
      preferMultiLayer: true,
    },
  })

  solver.solve()

  const output = solver.getOutput()

  // Should have created mesh nodes
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // Check if any nodes span multiple layers
  const multiLayerNodes = output.meshNodes.filter(
    (n) => n.availableZ && n.availableZ.length >= 2,
  )

  // With no obstacles and preferMultiLayer=true, we should get multi-layer nodes
  expect(multiLayerNodes.length).toBeGreaterThan(0)
})

test("RectDiffSolver respects single-layer minimums", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 5,
      minY: 0,
      maxY: 5,
    },
    obstacles: [],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.1,
  }

  const minWidth = 0.5
  const minHeight = 0.5

  const solver = new RectDiffPipeline({
    simpleRouteJson,
    gridOptions: {
      minSingle: { width: minWidth, height: minHeight },
      minMulti: { width: 1.0, height: 1.0, minLayers: 2 },
    },
  })

  solver.solve()

  const output = solver.getOutput()

  // All nodes should meet minimum requirements
  for (const node of output.meshNodes) {
    expect(node.width).toBeGreaterThanOrEqual(minWidth - 1e-6)
    expect(node.height).toBeGreaterThanOrEqual(minHeight - 1e-6)
  }
})

test("multi-layer mesh generation", () => {
  const srj: SimpleRouteJson = {
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    obstacles: [],
    connections: [],
    layerCount: 3,
    minTraceWidth: 0.2,
  }
  const pipeline = new RectDiffPipeline({ simpleRouteJson: srj })

  // Run to completion
  pipeline.solve()

  // Expect multi-layer mesh nodes to be created
  const mesh = pipeline.getOutput().meshNodes
  expect(mesh.length).toBeGreaterThan(0)

  // With no obstacles and multiple layers, we should get multi-layer nodes
  const multiLayerNodes = mesh.filter((n) => (n.availableZ?.length ?? 0) >= 2)
  expect(multiLayerNodes.length).toBeGreaterThan(0)
})
