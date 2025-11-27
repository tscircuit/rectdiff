// lib/solvers/rectdiff/subsolvers/GapFillSubSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { XYRect, Placed3D } from "../types"
import type {
  GapFillState,
  GapFillOptions,
  LayerContext,
} from "../gapfill/types"
import {
  initGapFillState,
  stepGapFill,
  getGapFillProgress,
} from "../gapfill/engine"

/**
 * SubSolver for filling gaps left by the grid-based placement.
 *
 * ## Algorithm Overview
 * Creates new rectangles to fill empty spaces (gaps) left after main grid placement.
 * Maximizes board coverage by detecting uncovered areas and placing optimally-sized rectangles.
 *
 * ## How It Works
 * 1. **Gap Detection**: Scans board to find uncovered rectangular regions, prioritizing larger gaps
 * 2. **Rectangle Expansion**: For each gap, expands a rectangle from seed points until hitting obstacles
 * 3. **Placement**: Places successfully expanded rectangles into the solution
 *
 * Uses a four-stage process: scan → select → expand → place for each gap.
 */
export class GapFillSubSolver extends BaseSolver {
  private state: GapFillState
  private layerCtx: LayerContext

  constructor(params: {
    placed: Placed3D[]
    options?: Partial<GapFillOptions>
    layerCtx: LayerContext
  }) {
    super()
    this.layerCtx = params.layerCtx
    this.state = initGapFillState(
      {
        placed: params.placed,
        options: params.options,
      },
      params.layerCtx,
    )
  }

  /**
   * Execute one step of the gap fill algorithm.
   * Each gap goes through four stages: scan for gaps, select a target gap,
   * expand a rectangle from seed point, then place the final result.
   */
  override _step() {
    const stillWorking = stepGapFill(this.state)
    if (!stillWorking) {
      this.solved = true
    }
  }

  /**
   * Calculate progress as a value between 0 and 1.
   * Accounts for iterations, gaps processed, and current stage within each gap.
   */
  computeProgress(): number {
    return getGapFillProgress(this.state)
  }

  /**
   * Get all placed rectangles including original ones plus newly created gap-fill rectangles.
   */
  getPlaced(): Placed3D[] {
    return this.state.placed
  }

  /**
   * Get placed rectangles organized by Z-layer for efficient layer-based operations.
   */
  getPlacedByLayer(): XYRect[][] {
    return this.state.placedByLayer
  }

  override getOutput() {
    return {
      placed: this.state.placed,
      placedByLayer: this.state.placedByLayer,
      filledCount: this.state.filledCount,
    }
  }

  /** Zen visualization: show four-stage gap filling process. */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const points: NonNullable<GraphicsObject["points"]> = []

    // Board bounds (subtle)
    rects.push({
      center: {
        x: this.layerCtx.bounds.x + this.layerCtx.bounds.width / 2,
        y: this.layerCtx.bounds.y + this.layerCtx.bounds.height / 2,
      },
      width: this.layerCtx.bounds.width,
      height: this.layerCtx.bounds.height,
      fill: "none",
      stroke: "#e5e7eb",
      label: "",
    })

    switch (this.state.stage) {
      case "scan": {
        // Stage 1: Show scanning/detection phase with light blue overlay
        rects.push({
          center: {
            x: this.layerCtx.bounds.x + this.layerCtx.bounds.width / 2,
            y: this.layerCtx.bounds.y + this.layerCtx.bounds.height / 2,
          },
          width: this.layerCtx.bounds.width,
          height: this.layerCtx.bounds.height,
          fill: "#dbeafe",
          stroke: "#3b82f6",
          label: "scanning",
        })
        break
      }

      case "select": {
        // Stage 2: Show the gap being targeted (red outline)
        if (this.state.currentGap) {
          rects.push({
            center: {
              x:
                this.state.currentGap.rect.x +
                this.state.currentGap.rect.width / 2,
              y:
                this.state.currentGap.rect.y +
                this.state.currentGap.rect.height / 2,
            },
            width: this.state.currentGap.rect.width,
            height: this.state.currentGap.rect.height,
            fill: "#fecaca",
            stroke: "#ef4444",
            label: "target gap",
          })

          // Show the seed point
          if (this.state.currentSeed) {
            points.push({
              x: this.state.currentSeed.x,
              y: this.state.currentSeed.y,
              color: "#dc2626",
              label: "seed",
            })
          }
        }
        break
      }

      case "expand": {
        // Stage 3: Show expansion attempt (yellow growing rectangle + seed)
        if (this.state.currentGap) {
          // Show gap outline (faded)
          rects.push({
            center: {
              x:
                this.state.currentGap.rect.x +
                this.state.currentGap.rect.width / 2,
              y:
                this.state.currentGap.rect.y +
                this.state.currentGap.rect.height / 2,
            },
            width: this.state.currentGap.rect.width,
            height: this.state.currentGap.rect.height,
            fill: "none",
            stroke: "#f87171",
            label: "",
          })
        }

        if (this.state.currentSeed) {
          // Show seed point
          points.push({
            x: this.state.currentSeed.x,
            y: this.state.currentSeed.y,
            color: "#f59e0b",
            label: "expanding",
          })
        }

        if (this.state.expandedRect) {
          // Show expanded rectangle
          rects.push({
            center: {
              x: this.state.expandedRect.x + this.state.expandedRect.width / 2,
              y: this.state.expandedRect.y + this.state.expandedRect.height / 2,
            },
            width: this.state.expandedRect.width,
            height: this.state.expandedRect.height,
            fill: "#fef3c7",
            stroke: "#f59e0b",
            label: "expanding",
          })
        }
        break
      }

      case "place": {
        // Stage 4: Show final placed rectangle (green)
        if (this.state.expandedRect) {
          rects.push({
            center: {
              x: this.state.expandedRect.x + this.state.expandedRect.width / 2,
              y: this.state.expandedRect.y + this.state.expandedRect.height / 2,
            },
            width: this.state.expandedRect.width,
            height: this.state.expandedRect.height,
            fill: "#bbf7d0",
            stroke: "#22c55e",
            label: "placed",
          })
        }
        break
      }
    }

    const stageNames = {
      scan: "scanning",
      select: "selecting",
      expand: "expanding",
      place: "placing",
    }

    return {
      title: `GapFill (${stageNames[this.state.stage]}): ${this.state.filledCount} filled`,
      coordinateSystem: "cartesian",
      rects,
      points,
    }
  }
}
