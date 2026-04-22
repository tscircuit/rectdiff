import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { Placed3D } from "lib/rectdiff-types"
import { getColorForZLayer } from "lib/utils/getColorForZLayer"
import { addGridLines, addInfoText, addSourcePlacements } from "./visualization"
import { maskToZLayers } from "./shared"

export type MaskGenerationSolverInput = {
  placed: Placed3D[]
  xs: number[]
  ys: number[]
  layerCount: number
  layerDiffs: number[][][]
}

export class MaskGenerationSolver extends BaseSolver {
  private layerMasks: number[][] = []
  private maskLayerIndex = 0
  private maskRowIndex = 0
  private lastMaskRow: Array<{
    x1: number
    x2: number
    y1: number
    y2: number
    mask: number
  }> = []

  constructor(private input: MaskGenerationSolverInput) {
    super()
  }

  override _setup() {
    this.layerMasks = Array.from(
      { length: Math.max(0, this.input.ys.length - 1) },
      () =>
        Array.from({ length: Math.max(0, this.input.xs.length - 1) }, () => 0),
    )
    this.stats = { maskLayerIndex: 0, maskRowIndex: 0 }
  }

  override _step() {
    this.lastMaskRow = []

    if (this.maskLayerIndex >= this.input.layerCount) {
      this.solved = true
      return
    }

    if (this.maskRowIndex >= this.input.ys.length - 1) {
      this.maskLayerIndex += 1
      this.maskRowIndex = 0
      return
    }

    const z = this.maskLayerIndex
    const y = this.maskRowIndex++
    const diff = this.input.layerDiffs[z]!
    let rowRunning = 0

    for (let x = 0; x < this.input.xs.length - 1; x++) {
      rowRunning += diff[y]![x]!
      const cellCount = rowRunning + (y > 0 ? diff[y - 1]![x]! : 0)
      diff[y]![x] = cellCount
      if (cellCount > 0) {
        this.layerMasks[y]![x]! |= 1 << z
        this.lastMaskRow.push({
          x1: this.input.xs[x]!,
          x2: this.input.xs[x + 1]!,
          y1: this.input.ys[y]!,
          y2: this.input.ys[y + 1]!,
          mask: this.layerMasks[y]![x]!,
        })
      }
    }

    this.stats.maskLayerIndex = this.maskLayerIndex
    this.stats.maskRowIndex = this.maskRowIndex
  }

  override getOutput() {
    return {
      placed: this.input.placed,
      xs: this.input.xs,
      ys: this.input.ys,
      layerCount: this.input.layerCount,
      layerMasks: this.layerMasks,
    }
  }

  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const lines: NonNullable<GraphicsObject["lines"]> = []
    const texts: NonNullable<GraphicsObject["texts"]> = []

    addSourcePlacements(rects, this.input.placed)
    addGridLines(lines, this.input.xs, this.input.ys)

    for (const cell of this.lastMaskRow) {
      const colors = getColorForZLayer(
        maskToZLayers(cell.mask, this.input.layerCount),
      )
      rects.push({
        center: {
          x: (cell.x1 + cell.x2) / 2,
          y: (cell.y1 + cell.y2) / 2,
        },
        width: cell.x2 - cell.x1,
        height: cell.y2 - cell.y1,
        fill: colors.fill,
        stroke: colors.stroke,
        label: `mask\nz:${maskToZLayers(cell.mask, this.input.layerCount).join(",")}`,
      })
    }

    addInfoText(
      texts,
      this.input.xs,
      this.input.ys,
      [
        `phase: masks`,
        `layer: ${Math.min(this.maskLayerIndex + 1, Math.max(1, this.input.layerCount))}/${Math.max(1, this.input.layerCount)}`,
        `row: ${this.maskRowIndex}/${Math.max(0, this.input.ys.length - 1)}`,
      ].join("\n"),
    )

    return {
      title: "Coverage Partition - Masks",
      coordinateSystem: "cartesian",
      rects,
      points: [],
      lines,
      texts,
    }
  }
}
