### High-Level Overview

The `rectdiff` algorithm is a sophisticated, multi-phase process designed to fill a multi-layered 2D space with rectangles, which are then converted into `CapacityMeshNode`s. Its primary goal is to maximize the use of available space, especially by creating large, multi-layer rectangles where possible, while also filling in smaller, irregular gaps.

The name `rectdiff` likely comes from its key feature: when placing new, high-priority rectangles, it can "subtract" or "carve up" existing, lower-priority rectangles that they overlap with. This is a significant departure from simpler packing algorithms that would just see the space as "taken".

The process is divided into three main phases:
1.  **Grid Phase**: Seeds the area with rectangles using progressively finer grids.
2.  **Expansion Phase**: Expands all previously placed rectangles to fill any remaining gaps.
3.  **Finalization**: Converts the results into the required output format.

---

### Key Concepts

Before diving into the steps, it's important to understand a few core ideas:

*   **Hard vs. Soft Nodes**: This is a crucial distinction.
    *   **Hard Nodes**: These are considered immovable blockers. They include the initial `obstacles` and any rectangles that have been placed across *all* available layers (full-stack nodes).
    *   **Soft Nodes**: These are any placed rectangles that only occupy a subset of the layers. They are considered mutable and can be resized or split by the algorithm.

*   **Candidates (`Candidate3D`)**: These are potential starting points (seeds) for placing a new rectangle. They are just `(x, y, z)` coordinates, ranked by how "good" they are. The ranking prioritizes:
    1.  **Z-Span Length**: The number of contiguous free layers at that (x,y) point. A longer span means a better opportunity for a valuable multi-layer node.
    2.  **Distance**: The distance to the nearest "hard" node or boundary. A larger distance means the candidate is in a more open area.

*   **Layers (`zLayers`)**: The 2D space is extruded into a 3D volume with discrete layers. The algorithm is constantly aware of which layers are occupied at any given (x,y) coordinate.

---

### Phase 1: Initialization (`initState`)

The process begins in `lib/solvers/rectdiff/engine.ts`:

1.  **Layer Mapping**: It analyzes the input `SimpleRouteJson` to identify all unique layer names (e.g., "top", "inner1", "bottom") and creates a canonical, sorted order. Each layer name is mapped to a numerical `z` index (`buildZIndexMap`).
2.  **Boundary & Obstacles**: It defines the overall `bounds` of the area and organizes all predefined `obstacles` into a per-layer data structure (`obstaclesByLayer`).
3.  **State Creation**: It creates the initial `RectDiffState` object, which holds all static and evolving data for the solve. It sets the initial `phase` to `"GRID"`.

---

### Phase 2: The Grid Phase (`stepGrid`)

This is the main rectangle-placement loop. It operates iteratively, and each call to `stepGrid` performs one small unit of work.

1.  **Multi-Grid Approach**: The algorithm iterates through several `gridSizes`, from coarse to fine. This allows it to first identify large, open areas for big rectangles and then fill in smaller details with finer grids.

2.  **Candidate Generation (`computeCandidates3D`)**: For the current grid size, it generates a list of `Candidate3D` seeds.
    *   It lays a grid over the entire area.
    *   It intelligently skips any grid point where **every layer** is already occupied by an obstacle or a previously placed node.
    *   For each valid point, it calculates its `zSpanLen` and `distance` (ignoring soft nodes) and sorts the candidates, best ones first.

3.  **Edge Candidate Generation (`computeEdgeCandidates3D`)**: After all grid-based candidates are exhausted, it performs a final, more precise seeding pass.
    *   It analyzes the exact edges of the main `bounds` and all "hard" nodes.
    *   It finds uncovered segments along these edges and places candidate seeds in those gaps. This is excellent for filling in long, thin areas that a coarse grid might miss.

4.  **Processing a Candidate**: The engine consumes one candidate at a time from the sorted list. For each candidate, it attempts to place a rectangle:
    *   **Multi-Layer First**: It checks for the `longestFreeSpanAroundZ`. If a sufficiently long span of free layers exists, it attempts to place a multi-layer rectangle.
    *   **Single-Layer Fallback**: If the multi-layer attempt fails or is not possible, it attempts to place a simple single-layer rectangle at the candidate's `z` index.

5.  **Rectangle Creation (`expandRectFromSeed`)**: This geometry function is called to create the actual rectangle.
    *   It starts with a small initial rectangle at the seed location.
    *   It greedily expands the rectangle in all four directions (up, down, left, right) until it hits a **hard node** or a boundary. **Crucially, it expands *through* soft nodes.**
    *   It stops expanding if it would violate the `maxAspectRatio` constraint.

6.  **Conflict Resolution (`resizeSoftOverlaps`)**: This is the "diff" magic.
    *   After a new rectangle is successfully placed, the algorithm checks if it overlaps with any existing **soft nodes** on the same layers.
    *   If an overlap is found, the old soft node is removed. The overlapping area is carved out of it using `subtractRect2D`.
    *   The remaining, non-overlapping parts of the old soft node are added back as one or more new, smaller `Placed3D` rectangles.

This subtractive process allows the algorithm to be aggressive, placing large, high-value (multi-layer) rectangles first and letting them "carve" their space out of less important, single-layer ones.

---

### Phase 3: The Expansion Phase (`stepExpansion`)

Once the Grid phase is complete (all candidates from all grids and edge analysis have been processed), the `phase` switches to `"EXPANSION"`.

1.  **Iterate and Expand**: The algorithm iterates through every single rectangle placed so far.
2.  **Final Growth**: For each rectangle, it calls `expandRectFromSeed` one last time. This time, there is **no aspect ratio limit**.
3.  **Fill Gaps**: This allows the rectangles to "swell" and consume any small, leftover slivers of empty space between them, maximizing space utilization.
4.  **Conflict Resolution**: The `resizeSoftOverlaps` logic is still active during this phase to resolve any new overlaps that might be created.

---

### Phase 4: Finalization (`finalizeRects` & `rectsToMeshNodes`)

When the Expansion phase is finished, the `phase` becomes `"DONE"`.

1.  The internal list of `Placed3D` objects is converted into the final `Rect3d[]` format.
2.  These `Rect3d` objects are then mapped to the `CapacityMeshNode[]` format, which is the expected output of the solver.