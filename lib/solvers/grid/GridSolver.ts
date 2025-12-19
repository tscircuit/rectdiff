import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { GridFill3DOptions, RectDiffState } from "../rectdiff/types"
import { initState, stepGrid } from "../rectdiff/engine"
import type { GraphicsObject } from "graphics-debug"
import { visualizeRectDiffState } from "../rectdiff/visualizeRectDiffState"

export type GridSolverInput = {
  simpleRouteJson: SimpleRouteJson
  gridOptions?: Partial<GridFill3DOptions>
}

export type GridSolverOutput = {
  rectDiffState: RectDiffState
}

export class GridSolver extends BaseSolver {
  private rectDiffState!: RectDiffState

  constructor(private gridSolverInput: GridSolverInput) {
    super()
  }

  override _setup() {
    const { simpleRouteJson, gridOptions } = this.gridSolverInput
    this.rectDiffState = initState(simpleRouteJson, gridOptions ?? {})
    this.stats = {
      gridIndex: this.rectDiffState.gridIndex,
    }
  }

  override _step() {
    stepGrid(this.rectDiffState)

    this.stats.gridIndex = this.rectDiffState.gridIndex
    this.stats.placed = this.rectDiffState.placed.length

    // Mark solved when all grids + edge analysis done
    if (
      this.rectDiffState.candidates.length === 0 &&
      this.rectDiffState.edgeAnalysisDone &&
      this.rectDiffState.gridIndex >=
        this.rectDiffState.options.gridSizes.length - 1
    ) {
      this.solved = true
    }
  }

  computeProgress(): number {
    const gridSizeList = this.rectDiffState.options.gridSizes
    const currentGridIndex = this.rectDiffState.gridIndex
    const totalGridCount = gridSizeList.length

    // Progress through grid sizes
    const gridIndexProgress = currentGridIndex / totalGridCount

    // Progress through current grid's seeds
    const totalSeeds = Math.max(1, this.rectDiffState.totalSeedsThisGrid)
    const consumedSeeds = this.rectDiffState.consumedSeedsThisGrid
    const seedProgress = Math.min(1, consumedSeeds / totalSeeds)

    // Combine: gridIndex weight + current grid seed progress
    const baseProgress = gridIndexProgress + seedProgress / totalGridCount

    // Account for edge analysis as final step
    if (this.rectDiffState.edgeAnalysisDone) {
      return Math.min(1, baseProgress)
    }

    return Math.min(0.99, baseProgress)
  }

  override getOutput(): GridSolverOutput {
    return { rectDiffState: this.rectDiffState }
  }

  override visualize(): GraphicsObject {
    const baseVisualization = visualizeRectDiffState(
      this.rectDiffState,
      this.gridSolverInput.simpleRouteJson,
    )

    const gridPointList: NonNullable<GraphicsObject["points"]> = []

    const boundsRect = this.rectDiffState.bounds
    const gridSizeList = this.rectDiffState.options.gridSizes
    const currentGridSize =
      gridSizeList[this.rectDiffState.gridIndex] ??
      gridSizeList[gridSizeList.length - 1]!

    const maxX = boundsRect.x + boundsRect.width
    const maxY = boundsRect.y + boundsRect.height

    for (let x = boundsRect.x; x <= maxX; x += currentGridSize) {
      for (let y = boundsRect.y; y <= maxY; y += currentGridSize) {
        gridPointList.push({
          x,
          y,
          label: "grid",
        })
      }
    }

    return {
      ...baseVisualization,
      title: `RectDiff GRID`,
      points: [...(baseVisualization.points ?? []), ...gridPointList],
    }
  }
}
