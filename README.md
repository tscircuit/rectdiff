# @tscircuit/rectdiff

This is a 3D rectangle diffing algorithm made to quickly break apart a circuit board
into capacity nodes for the purpose of global routing.

[Online Demo](https://rectdiff.tscircuit.com/?fixture=%7B%22path%22%3A%22pages%2Fexample01.page.tsx%22%7D)

## Usage

### Basic Usage

```typescript
import { RectDiffSolver } from "@tscircuit/rectdiff"
import type { SimpleRouteJson } from "@tscircuit/rectdiff"

// Define your circuit board layout
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

// Create and run the solver
const solver = new RectDiffSolver({
  simpleRouteJson,
  mode: "grid",
})

solver.solve()

// Get the capacity mesh nodes
const output = solver.getOutput()
console.log(`Generated ${output.meshNodes.length} capacity mesh nodes`)

// Each mesh node contains:
// - center: { x, y } - center point of the node
// - width, height - dimensions
// - availableZ - array of available z-layers (e.g., [0, 1, 2])
```

### Advanced Configuration with Grid Options

```typescript
const solver = new RectDiffSolver({
  simpleRouteJson,
  mode: "grid",
  gridOptions: {
    minSingle: { width: 0.4, height: 0.4 },
    minMulti: { width: 1.0, height: 1.0, minLayers: 2 },
    preferMultiLayer: true,
  },
})

solver.solve()
```

### Incremental Solving with Visualization

The solver supports incremental solving for visualization and progress tracking:

```typescript
const solver = new RectDiffSolver({ simpleRouteJson })

solver.setup()

// Step through the algorithm incrementally
while (!solver.solved) {
  solver.step()

  // Get current progress
  const progress = solver.computeProgress()
  console.log(`Progress: ${(progress * 100).toFixed(1)}%`)

  // Visualize current state
  const graphicsObject = solver.visualize()
  // Use graphicsObject with graphics-debug package
}

const output = solver.getOutput()
```

### Working with Results

```typescript
const output = solver.getOutput()

// Iterate through mesh nodes
for (const node of output.meshNodes) {
  console.log(`Node at (${node.center.x}, ${node.center.y})`)
  console.log(`  Size: ${node.width} x ${node.height}`)
  console.log(`  Available layers: ${node.availableZ?.join(", ") || "none"}`)

  // Use node for routing decisions
  if (node.availableZ && node.availableZ.length >= 2) {
    console.log("  This node spans multiple layers!")
  }
}
```

### API Reference

#### Constructor Options

- `simpleRouteJson` (required): The circuit board layout definition

  - `bounds`: Board boundaries (minX, maxX, minY, maxY)
  - `obstacles`: Array of rectangular obstacles on the board
  - `connections`: Connection requirements between points
  - `layerCount`: Number of layers in the board
  - `minTraceWidth`: Minimum trace width for routing

- `mode`: "grid" | "exact" (default: "grid")

  - Currently only "grid" mode is implemented

- `gridOptions`: Fine-tune the grid-based expansion algorithm
  - `minSingle`: Minimum dimensions for single-layer nodes
  - `minMulti`: Minimum dimensions and layer count for multi-layer nodes
  - `preferMultiLayer`: Whether to prefer multi-layer spanning nodes

#### Methods

- `setup()`: Initialize the solver
- `step()`: Execute one iteration step
- `solve()`: Run solver to completion
- `computeProgress()`: Get current progress (0.0 to 1.0)
- `getOutput()`: Get the capacity mesh nodes result
- `visualize()`: Get GraphicsObject for visualization with graphics-debug
