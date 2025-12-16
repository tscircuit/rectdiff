// lib/solvers/rectdiff/subsolvers/EdgeExpansionGapFillSubSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { XYRect, Placed3D } from "../types"
import type {
  EdgeExpansionGapFillState,
  EdgeExpansionGapFillOptions,
} from "../edge-expansion-gapfill/types"
import { initState } from "../edge-expansion-gapfill/initState"
import { stepExpansion } from "../edge-expansion-gapfill/stepExpansion"
import { computeProgress } from "../edge-expansion-gapfill/computeProgress"

/**
 * A subsolver that fills gaps by expanding rectangles from obstacle boundaries.
 *
 * Unlike the grid-based GapFillSubSolver, this approach:
 * 1. Processes one obstacle at a time
 * 2. Places 8 expansion rects (4 edges + 4 corners) around each obstacle
 * 3. Filters out rects that overlap with existing capacity nodes
 * 4. Expands valid rects to fill remaining space
 *
 * This creates a more connected mesh by filling gaps between existing nodes.
 */
export class EdgeExpansionGapFillSubSolver extends BaseSolver {
  private state: EdgeExpansionGapFillState
  private bounds: XYRect

  constructor(params: {
    bounds: XYRect
    layerCount: number
    obstacles: XYRect[][]
    existingPlaced: Placed3D[]
    existingPlacedByLayer: XYRect[][]
    options?: Partial<EdgeExpansionGapFillOptions>
  }) {
    super()
    this.bounds = params.bounds
    this.state = initState({
      bounds: params.bounds,
      layerCount: params.layerCount,
      obstacles: params.obstacles,
      existingPlaced: params.existingPlaced,
      existingPlacedByLayer: params.existingPlacedByLayer,
      options: params.options,
    })
  }

  override _setup() {
    // State is initialized in constructor, nothing to do here
  }

  /**
   * Execute one step of the gap fill algorithm.
   * Super granular: expands one node in one direction per step.
   */
  override _step() {
    const stillWorking = stepExpansion(this.state)
    if (!stillWorking) {
      this.solved = true
    }
  }

  /**
   * Calculate progress as a value between 0 and 1.
   */
  computeProgress(): number {
    return computeProgress(this.state)
  }

  /**
   * Get newly placed gap-fill rectangles.
   */
  getNewPlaced(): Placed3D[] {
    return this.state.newPlaced
  }

  /**
   * Get all placed rectangles (existing + new).
   */
  getAllPlaced(): Placed3D[] {
    return [...this.state.existingPlaced, ...this.state.newPlaced]
  }

  override getOutput() {
    return {
      newPlaced: this.state.newPlaced,
      allPlaced: this.getAllPlaced(),
    }
  }

  /**
   * Visualization: show current obstacle being processed and expansion nodes.
   */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []

    // Board bounds (subtle)
    rects.push({
      center: {
        x: this.bounds.x + this.bounds.width / 2,
        y: this.bounds.y + this.bounds.height / 2,
      },
      width: this.bounds.width,
      height: this.bounds.height,
      fill: "none",
      stroke: "#e5e7eb",
      label: "",
    })

    // Show existing placed nodes (subtle gray)
    for (const placed of this.state.existingPlaced) {
      rects.push({
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        fill: "#f3f4f6",
        stroke: "#d1d5db",
        label: "",
      })
    }

    // Show obstacles (red)
    for (let z = 0; z < this.state.layerCount; z++) {
      if (this.state.obstacles[z]) {
        for (const obstacle of this.state.obstacles[z]!) {
          rects.push({
            center: {
              x: obstacle.x + obstacle.width / 2,
              y: obstacle.y + obstacle.height / 2,
            },
            width: obstacle.width,
            height: obstacle.height,
            fill: "#fee2e2",
            stroke: "#ef4444",
            label: "",
          })
        }
      }
    }

    // Highlight current obstacle being processed (yellow)
    const currentObstacle =
      this.state.edgeExpansionObstacles[this.state.currentObstacleIndex]

    if (currentObstacle && this.state.nodes.length > 0) {
      rects.push({
        center: {
          x: currentObstacle.center.x,
          y: currentObstacle.center.y,
        },
        width: currentObstacle.rect.width,
        height: currentObstacle.rect.height,
        fill: "#fef3c7",
        stroke: "#f59e0b",
        label: "processing",
      })
    }

    // Show current expansion nodes (blue)
    for (const node of this.state.nodes) {
      const isCurrentNode = node.id === this.state.currentNodeId

      // Calculate minimum visual size relative to board dimensions
      const boardScale = Math.min(this.bounds.width, this.bounds.height)
      const MIN_VISUAL_SIZE = boardScale * 0.001

      let displayRect = { ...node.rect }

      // Apply minimum visual size for edges (only to the thin dimension)
      if (node.direction === "up" || node.direction === "down") {
        // Horizontal edge - ensure minimum height
        if (displayRect.height < MIN_VISUAL_SIZE) {
          displayRect.height = MIN_VISUAL_SIZE
        }
      } else {
        // Vertical edge - ensure minimum width
        if (displayRect.width < MIN_VISUAL_SIZE) {
          displayRect.width = MIN_VISUAL_SIZE
        }
      }

      rects.push({
        center: {
          x: displayRect.x + displayRect.width / 2,
          y: displayRect.y + displayRect.height / 2,
        },
        width: displayRect.width,
        height: displayRect.height,
        fill: isCurrentNode ? "#fef3c7" : "#dbeafe",
        stroke: isCurrentNode ? "#f59e0b" : "#3b82f6",
        label: isCurrentNode ? "expanding" : "",
      })
    }

    // Show newly placed gap-fill nodes (green)
    for (const placed of this.state.newPlaced) {
      rects.push({
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        fill: "#bbf7d0",
        stroke: "#22c55e",
        label: "gap-fill",
      })
    }

    const totalObstacles = this.state.edgeExpansionObstacles.length
    const obstacleProgress = `${this.state.currentObstacleIndex}/${totalObstacles}`
    const nodesActive = this.state.nodes.length

    return {
      title: `EdgeExpansionGapFill (obs: ${obstacleProgress}, nodes: ${nodesActive})`,
      coordinateSystem: "cartesian",
      rects,
      points,
    }
  }
}
