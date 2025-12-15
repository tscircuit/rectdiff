# EdgeExpansionSolver

A new algorithm for generating capacity mesh nodes by expanding nodes from obstacle edges and corners.

## Overview

The EdgeExpansionSolver takes a completely different approach from RectDiffSolver:

**RectDiffSolver**: Grid-based expansion from seed points
**EdgeExpansionSolver**: Creates nodes at obstacle boundaries and expands them outward

## Algorithm

### Initialization
For each obstacle, create 8 capacity nodes:
- 4 edge nodes (top, bottom, left, right) - 1D lines along obstacle edges
- 4 corner nodes (all corners) - 0D points at obstacle corners

Each node has "free dimensions" indicating which directions it can expand:
- Top edge: can expand upward (y-)
- Bottom edge: can expand downward (y+)
- Left edge: can expand leftward (x-)
- Right edge: can expand rightward (x+)
- Corners: can expand in 2 directions

### Expansion Process (Granular Stepping)

The solver uses a **round-based** approach with **granular steps**:

#### Round Setup:
1. Identify all nodes that can still expand (have space >= `minRequiredExpandSpace`)
2. Sort nodes by potential area (largest first for priority)
3. Queue them for processing

#### Step Execution:
Each `step()` call processes **ONE node in ONE direction**:
1. Get current node from round queue
2. Get next free dimension to expand
3. Calculate available space in that direction (checking bounds, obstacles, other nodes)
4. If space >= threshold: expand fully to available limit
5. Advance to next direction, or next node if all directions processed
6. When node completes all directions, check if it should be marked "done"

#### Completion:
- When all nodes in a round are processed, start a new round
- When no nodes can expand anymore, phase = DONE

### Conflict Resolution

Priority-based expansion prevents overlap:
- Larger potential nodes expand first (greedy approach)
- Each expansion recalculates available space (accounts for previous expansions)
- Nodes become blockers for subsequent nodes in the same round

## Edge Cases Handled

1. **Multiple connected obstacles**: Priority system ensures largest nodes win
2. **Trapped obstacles**: All 8 surrounding nodes compete fairly
3. **Tight gaps**: `minRequiredExpandSpace` threshold prevents tiny slivers
4. **Adjacent obstacles**: Proper collision detection with epsilon tolerance

## Usage

```typescript
import { EdgeExpansionSolver } from "@tscircuit/rectdiff"

const solver = new EdgeExpansionSolver({
  simpleRouteJson: {
    bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 50, y: 50 },
        width: 20,
        height: 20,
        connectedTo: [],
      }
    ],
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.15,
  },
  options: {
    minRequiredExpandSpace: 5, // Minimum space to continue expanding
  },
})

// Solve completely
solver.solve()
const output = solver.getOutput()

// OR step through incrementally (hundreds of granular steps)
solver.setup()
while (!solver.solved) {
  solver.step() // Expands one node in one direction
  const viz = solver.visualize() // See current state
}
```

## Configuration

Edit `edge-expansion.config.ts` at repository root:

```typescript
export const EDGE_EXPANSION_CONFIG = {
  MIN_REQUIRED_EXPAND_SPACE: 5, // Adjust for different coverage vs performance
}
```

**Smaller values** (1-3): More aggressive, fills tighter spaces, may create small nodes
**Larger values** (10-20): More conservative, faster, may leave gaps

## Visualization Features

The solver provides rich visualization:

- **Yellow/Orange nodes**: Currently being processed this step
- **Light blue nodes**: Queued/pending expansion
- **Dark blue nodes**: Completed expansion

Statistics exposed:
- `iteration`: Total step count
- `roundSize`: Number of nodes in current round
- `currentNodeIndex`: Which node in round is processing
- `phase`: EXPANDING or DONE

## Performance Characteristics

**Steps per scenario**:
- 1 obstacle with space: ~8-16 steps (8 nodes × 1-2 directions each)
- 3 obstacles with gaps: ~50-150 steps depending on competition
- Complex boards: 200-500+ granular steps

**Time Complexity**:
- Per step: O(N + O) where N = nodes, O = obstacles
- Total: O(S × (N + O)) where S = total steps

**Memory**: O(N) for node storage

## Comparison with RectDiffSolver

| Feature | RectDiffSolver | EdgeExpansionSolver |
|---------|----------------|---------------------|
| Approach | Grid-based seeds | Obstacle boundary expansion |
| 3D Layers | Yes | No (2D only) |
| Step Granularity | Varies | Very fine (1 direction per step) |
| Coverage | Grid-dependent | Obstacle-focused |
| Best For | Global routing | Simple 2D scenarios |

## Visualization Pages

Three visualization pages are available:

1. **edge-expansion-example01.page.tsx**: Test with predefined example
2. **edge-expansion-random.page.tsx**: Random obstacles with regeneration
3. **edge-expansion-interactive.page.tsx**: Full interactive controls, step-by-step

## Testing

Run tests:
```bash
bun test tests/edge-expansion-solver.test.ts
```

Tests cover:
- Basic mesh node generation
- Multiple obstacles
- Adjacent obstacles
- Incremental stepping
- Threshold behavior

