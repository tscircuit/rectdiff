// lib/solvers/EdgeExpansionSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"
import type { EdgeExpansionOptions, EdgeExpansionState } from "./edge-expansion/types"
import { initState } from "./edge-expansion/initState"
import { stepExpansion } from "./edge-expansion/stepExpansion"
import { solve as solveToCompletion } from "./edge-expansion/solve"
import { computeProgress } from "./edge-expansion/computeProgress"

/**
 * EdgeExpansionSolver: A new algorithm for generating capacity mesh nodes
 * by expanding nodes from obstacle edges and corners.
 *
 * Algorithm:
 * 1. Create 8 nodes per obstacle (4 edges + 4 corners)
 * 2. Each iteration:
 *    - Identify nodes that can expand (have space >= minRequiredExpandSpace)
 *    - Sort by potential area (largest first for priority)
 *    - Expand each node fully in all free dimensions
 *    - Re-validate space before each expansion (conflict resolution)
 * 3. Stop when no nodes can expand further
 */
export class EdgeExpansionSolver extends BaseSolver {
  private srj: SimpleRouteJson
  private options: Partial<EdgeExpansionOptions>
  private state!: EdgeExpansionState
  private _meshNodes: CapacityMeshNode[] = []

  constructor(opts: {
    simpleRouteJson: SimpleRouteJson
    options?: Partial<EdgeExpansionOptions>
  }) {
    super()
    this.srj = opts.simpleRouteJson
    this.options = opts.options ?? {}
  }

  override _setup() {
    this.state = initState(this.srj, this.options)
    this.stats = {
      phase: this.state.phase,
      iteration: this.state.iteration,
      roundSize: this.state.currentRound.length,
      currentNodeIndex: this.state.currentNodeIndex,
    }
  }

  /** Execute one granular step: expand ONE node in ONE direction */
  override _step() {
    if (this.state.phase === "DONE") {
      if (!this.solved) {
        this._meshNodes = this.convertNodesToMeshNodes()
        this.solved = true
      }
      return
    }

    const didWork = stepExpansion(this.state)

    // Update stats
    this.stats.phase = this.state.phase
    this.stats.iteration = this.state.iteration
    this.stats.roundSize = this.state.currentRound.length
    this.stats.currentNodeIndex = this.state.currentNodeIndex

    // Check if done (stepExpansion sets phase to DONE when no work remains)
    if (!didWork) {
      this._meshNodes = this.convertNodesToMeshNodes()
      this.solved = true
    }
  }

  /** Compute solver progress (0 to 1) */
  computeProgress(): number {
    if (this.solved || this.state.phase === "DONE") {
      return 1
    }
    return computeProgress(this.state)
  }

  /** Get the final mesh nodes output */
  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    return { meshNodes: this._meshNodes }
  }

  /** Solve to completion (non-incremental) */
  solveCompletely(maxIterations = 100): void {
    if (!this.state) {
      this._setup()
    }
    solveToCompletion(this.state, maxIterations)
    this._meshNodes = this.convertNodesToMeshNodes()
    this.solved = true
  }

  /**
   * Convert internal capacity nodes to CapacityMeshNode format.
   * Only include nodes with non-zero area (accounting for initial minimum sizes).
   */
  private convertNodesToMeshNodes(): CapacityMeshNode[] {
    const meshNodes: CapacityMeshNode[] = []
    const MIN_MEANINGFUL_SIZE = 5 // Filter out nodes that haven't expanded beyond initial size

    for (const node of this.state.nodes) {
      // Only include nodes that have expanded to meaningful size
      if (node.width > MIN_MEANINGFUL_SIZE && node.height > MIN_MEANINGFUL_SIZE) {
        meshNodes.push({
          capacityMeshNodeId: node.id,
          center: {
            x: node.x + node.width / 2,
            y: node.y + node.height / 2,
          },
          width: node.width,
          height: node.height,
          layer: "all", // 2D only, no z-layer handling
          availableZ: [0], // Default to layer 0
        })
      }
    }

    return meshNodes
  }

  /** Get color for node visualization based on state */
  private getNodeColor(node: typeof this.state.nodes[0]): {
    fill: string
    stroke: string
  } {
    // Highlight the node currently being processed
    if (this.state.currentNodeId === node.id && !node.done) {
      return { fill: "#fbbf24", stroke: "#f59e0b" } // Yellow/orange for actively processing
    }
    if (node.done) {
      return { fill: "#60a5fa", stroke: "#2563eb" } // Dark blue for done
    }
    return { fill: "#93c5fd", stroke: "#2563eb" } // Light blue for queued/pending
  }

  /** Visualization for debugging */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []

    // Draw bounds
    rects.push({
      center: {
        x: this.state.bounds.x + this.state.bounds.width / 2,
        y: this.state.bounds.y + this.state.bounds.height / 2,
      },
      width: this.state.bounds.width,
      height: this.state.bounds.height,
      fill: "none",
      stroke: "#666666",
      label: "bounds",
    })

    // Draw obstacles
    for (const obs of this.state.obstacles) {
      rects.push({
        center: { x: obs.x + obs.width / 2, y: obs.y + obs.height / 2 },
        width: obs.width,
        height: obs.height,
        fill: "#fee2e2",
        stroke: "#ef4444",
        label: "obstacle",
      })
    }

    // Draw capacity nodes (render with minimum visual size, preserving orientation)
    const bounds = this.state.bounds
    const boardScale = (bounds.width + bounds.height) / 2
    const MIN_VISUAL_SIZE = boardScale * 0.001 // Relative to board scale
    
    for (const node of this.state.nodes) {
      const colors = this.getNodeColor(node)
      
      // Preserve orientation: only apply MIN_VISUAL_SIZE to dimensions that need it
      let visualWidth = node.width
      let visualHeight = node.height
      
      // For edge nodes, preserve the obstacle dimension
      if (node.nodeType === "edge") {
        // Horizontal edges (top/bottom): keep width, ensure min height
        if (node.freeDimensions.includes("y-") || node.freeDimensions.includes("y+")) {
          visualHeight = Math.max(node.height, MIN_VISUAL_SIZE)
        }
        // Vertical edges (left/right): keep height, ensure min width
        else if (node.freeDimensions.includes("x-") || node.freeDimensions.includes("x+")) {
          visualWidth = Math.max(node.width, MIN_VISUAL_SIZE)
        }
      } else {
        // Corner nodes: apply min to both dimensions
        visualWidth = Math.max(node.width, MIN_VISUAL_SIZE)
        visualHeight = Math.max(node.height, MIN_VISUAL_SIZE)
      }
      
      rects.push({
        center: { 
          x: node.x + node.width / 2, 
          y: node.y + node.height / 2 
        },
        width: visualWidth,
        height: visualHeight,
        fill: colors.fill,
        stroke: colors.stroke,
        label: `${node.id}\n${node.done ? "done" : "active"}`,
      })
    }

    return {
      title: `EdgeExpansion (${this.state.phase}) - Iteration ${this.state.iteration}`,
      coordinateSystem: "cartesian",
      rects,
      points,
    }
  }
}

// Re-export types for convenience
export type { EdgeExpansionOptions } from "./edge-expansion/types"

