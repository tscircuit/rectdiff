import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { Placed3D } from "lib/rectdiff-types"
import { addGridLines, addInfoText, addSourcePlacements } from "./visualization"
import { buildCoverageGrid } from "./shared"

export type PlacementDiffSolverInput = {
  placed: Placed3D[]
}

export class PlacementDiffSolver extends BaseSolver {
  private xs: number[] = []
  private ys: number[] = []
  private xIndex = new Map<number, number>()
  private yIndex = new Map<number, number>()
  private layerCount = 0
  private layerDiffs: Int32Array[][] = []
  private placementIndex = 0
  private lastPlacement: Placed3D | null = null

  constructor(private input: PlacementDiffSolverInput) {
    super()
  }

  override _setup() {
    const grid = buildCoverageGrid(this.input.placed)
    this.xs = grid.xs
    this.ys = grid.ys
    this.xIndex = grid.xIndex
    this.yIndex = grid.yIndex
    this.layerCount = grid.layerCount
    this.layerDiffs = grid.layerDiffs
    this.stats = { placementIndex: 0, placed: this.input.placed.length }
  }

  override _step() {
    if (this.placementIndex >= this.input.placed.length) {
      this.solved = true
      this.lastPlacement = null
      return
    }

    const placement = this.input.placed[this.placementIndex++]!
    this.lastPlacement = placement

    const x1 = this.xIndex.get(placement.rect.x)
    const x2 = this.xIndex.get(placement.rect.x + placement.rect.width)
    const y1 = this.yIndex.get(placement.rect.y)
    const y2 = this.yIndex.get(placement.rect.y + placement.rect.height)
    if (
      x1 === undefined ||
      x2 === undefined ||
      y1 === undefined ||
      y2 === undefined
    ) {
      return
    }

    for (const z of placement.zLayers) {
      const diff = this.layerDiffs[z]
      if (!diff) continue
      diff[y1]![x1]! += 1
      diff[y2]![x1]! -= 1
      diff[y1]![x2]! -= 1
      diff[y2]![x2]! += 1
    }

    this.stats.placementIndex = this.placementIndex
  }

  override getOutput() {
    return {
      placed: this.input.placed,
      xs: this.xs,
      ys: this.ys,
      layerCount: this.layerCount,
      layerDiffs: this.layerDiffs.map((rows) =>
        rows.map((row) => Array.from(row)),
      ),
    }
  }

  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const lines: NonNullable<GraphicsObject["lines"]> = []
    const texts: NonNullable<GraphicsObject["texts"]> = []

    addSourcePlacements(rects, this.input.placed)
    addGridLines(lines, this.xs, this.ys)

    if (this.lastPlacement) {
      rects.push({
        center: {
          x: this.lastPlacement.rect.x + this.lastPlacement.rect.width / 2,
          y: this.lastPlacement.rect.y + this.lastPlacement.rect.height / 2,
        },
        width: this.lastPlacement.rect.width,
        height: this.lastPlacement.rect.height,
        fill: "rgba(59, 130, 246, 0.2)",
        stroke: "rgba(37, 99, 235, 0.95)",
        label: `apply\nz:${this.lastPlacement.zLayers.join(",")}`,
      })
    }

    addInfoText(
      texts,
      this.xs,
      this.ys,
      [
        `phase: placements`,
        `placements: ${this.placementIndex}/${this.input.placed.length}`,
      ].join("\n"),
    )

    return {
      title: "Coverage Partition - Placements",
      coordinateSystem: "cartesian",
      rects,
      points: [],
      lines,
      texts,
    }
  }
}
