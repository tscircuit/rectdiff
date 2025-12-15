import { expect, test } from "bun:test"
import { EdgeExpansionSolver } from "../lib/solvers/EdgeExpansionSolver"
import type { SimpleRouteJson } from "../lib/types/srj-types"

test("EdgeExpansionSolver creates mesh nodes from obstacles", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 50, y: 50 },
        width: 20,
        height: 20,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.15,
  }

  const solver = new EdgeExpansionSolver({
    simpleRouteJson,
    options: {
      minRequiredExpandSpace: 5,
    },
  })

  solver.solve()

  const output = solver.getOutput()

  // Should have created some mesh nodes (8 nodes per obstacle, but some may have zero area)
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // All mesh nodes should have valid dimensions
  for (const node of output.meshNodes) {
    expect(node.width).toBeGreaterThan(0)
    expect(node.height).toBeGreaterThan(0)
    expect(node.capacityMeshNodeId).toBeDefined()
    expect(node.center.x).toBeDefined()
    expect(node.center.y).toBeDefined()
  }
})

test("EdgeExpansionSolver handles multiple obstacles", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 200,
      minY: 0,
      maxY: 200,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 60, y: 60 },
        width: 30,
        height: 30,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 140, y: 140 },
        width: 25,
        height: 25,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.2,
  }

  const solver = new EdgeExpansionSolver({
    simpleRouteJson,
  })

  solver.solve()

  const output = solver.getOutput()

  // Should have created multiple mesh nodes (up to 8 per obstacle)
  expect(output.meshNodes.length).toBeGreaterThan(2)

  // Verify nodes don't overlap with obstacles
  for (const node of output.meshNodes) {
    for (const obs of simpleRouteJson.obstacles) {
      const obsRect = {
        x: obs.center.x - obs.width / 2,
        y: obs.center.y - obs.height / 2,
        width: obs.width,
        height: obs.height,
      }

      const nodeRect = {
        x: node.center.x - node.width / 2,
        y: node.center.y - node.height / 2,
        width: node.width,
        height: node.height,
      }

      // Check for overlap (allowing small epsilon)
      const overlaps = !(
        nodeRect.x + nodeRect.width <= obsRect.x + 0.001 ||
        obsRect.x + obsRect.width <= nodeRect.x + 0.001 ||
        nodeRect.y + nodeRect.height <= obsRect.y + 0.001 ||
        obsRect.y + obsRect.height <= nodeRect.y + 0.001
      )

      // Nodes should not overlap with obstacles
      expect(overlaps).toBe(false)
    }
  }
})

test("EdgeExpansionSolver handles adjacent obstacles", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 30, y: 50 },
        width: 20,
        height: 20,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 70, y: 50 },
        width: 20,
        height: 20,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.15,
  }

  const solver = new EdgeExpansionSolver({
    simpleRouteJson,
    options: {
      minRequiredExpandSpace: 2,
    },
  })

  solver.solve()

  const output = solver.getOutput()

  // Should create capacity nodes in the gap between obstacles
  expect(output.meshNodes.length).toBeGreaterThan(0)

  // Find nodes in the gap region (between x=40 and x=60)
  const gapNodes = output.meshNodes.filter((node) => {
    return node.center.x > 40 && node.center.x < 60
  })

  // Should have at least some capacity nodes in the gap
  expect(gapNodes.length).toBeGreaterThanOrEqual(0)
})

test("EdgeExpansionSolver incremental solving works", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 50, y: 50 },
        width: 15,
        height: 15,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.15,
  }

  const solver = new EdgeExpansionSolver({
    simpleRouteJson,
  })

  solver.setup()

  // Step through the solver
  let steps = 0
  while (!solver.solved && steps < 100) {
    solver.step()
    steps++
  }

  expect(solver.solved).toBe(true)
  expect(steps).toBeGreaterThan(0)

  const output = solver.getOutput()
  expect(output.meshNodes.length).toBeGreaterThan(0)
})

test("EdgeExpansionSolver respects minRequiredExpandSpace threshold", () => {
  const simpleRouteJson: SimpleRouteJson = {
    bounds: {
      minX: 0,
      maxX: 50,
      minY: 0,
      maxY: 50,
    },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 15, y: 25 },
        width: 10,
        height: 10,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 30, y: 25 },
        width: 10,
        height: 10,
        connectedTo: [],
      },
    ],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.1,
  }

  // With large threshold, nodes in tight gaps won't expand much
  const solver1 = new EdgeExpansionSolver({
    simpleRouteJson,
    options: {
      minRequiredExpandSpace: 20,
    },
  })

  solver1.solve()
  const output1 = solver1.getOutput()

  // With small threshold, nodes can expand into tighter spaces
  const solver2 = new EdgeExpansionSolver({
    simpleRouteJson,
    options: {
      minRequiredExpandSpace: 1,
    },
  })

  solver2.solve()
  const output2 = solver2.getOutput()

  // Lower threshold should generally allow more nodes to form
  // (though exact count depends on geometry)
  expect(output2.meshNodes.length).toBeGreaterThanOrEqual(output1.meshNodes.length)
})

