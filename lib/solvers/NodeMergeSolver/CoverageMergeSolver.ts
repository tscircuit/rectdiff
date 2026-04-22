import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { Placed3D, Rect3d } from "lib/rectdiff-types"
import type { ActiveRect } from "./shared"
import { activeRectToRect3d } from "./shared"
import {
  addActiveRects,
  addGridLines,
  addInfoText,
  addRect3dOverlays,
  addSourcePlacements,
} from "./visualization"

export type CoverageMergeSolverInput = {
  placed: Placed3D[]
  xs: number[]
  ys: number[]
  layerCount: number
  layerMasks: number[][]
  maxAspectRatio?: number | null
}

export class CoverageMergeSolver extends BaseSolver {
  private mergeRowIndex = 0
  private activeRects = new Map<string, ActiveRect>()
  private coverageRects: Rect3d[] = []
  private lastMergedRects: Rect3d[] = []

  constructor(private input: CoverageMergeSolverInput) {
    super()
  }

  override _setup() {
    this.stats = { mergeRowIndex: 0 }
  }

  override _step() {
    this.lastMergedRects = []

    if (this.mergeRowIndex >= this.input.ys.length - 1) {
      for (const rect of this.activeRects.values()) {
        this.pushFinalizedRect(rect)
      }
      this.activeRects.clear()
      this.solved = true
      return
    }

    const y = this.mergeRowIndex++
    const nextActiveKeys = new Set<string>()
    let x = 0

    while (x < this.input.xs.length - 1) {
      const mask = this.input.layerMasks[y]![x]!
      if (mask === 0) {
        x += 1
        continue
      }

      const xStart = x
      x += 1
      while (
        x < this.input.xs.length - 1 &&
        this.input.layerMasks[y]![x] === mask
      ) {
        x += 1
      }

      const key = `${mask}:${this.input.xs[xStart]}:${this.input.xs[x]}`
      const existing = this.activeRects.get(key)
      const nextMinY = this.input.ys[y]!
      const nextMaxY = this.input.ys[y + 1]!
      if (existing && existing.maxY === nextMinY) {
        const width = existing.maxX - existing.minX
        const currentHeight = existing.maxY - existing.minY
        const nextHeight = nextMaxY - existing.minY
        const maxAspectRatio = this.input.maxAspectRatio
        const exceedsAspect =
          maxAspectRatio != null &&
          width > 0 &&
          nextHeight > 0 &&
          currentHeight >= width &&
          nextHeight > maxAspectRatio * width

        if (exceedsAspect) {
          this.pushFinalizedRect(existing)
          this.activeRects.set(key, {
            minX: this.input.xs[xStart]!,
            maxX: this.input.xs[x]!,
            minY: nextMinY,
            maxY: nextMaxY,
            mask,
          })
        } else {
          existing.maxY = nextMaxY
        }
      } else {
        if (existing) {
          this.pushFinalizedRect(existing)
        }
        this.activeRects.set(key, {
          minX: this.input.xs[xStart]!,
          maxX: this.input.xs[x]!,
          minY: nextMinY,
          maxY: nextMaxY,
          mask,
        })
      }
      nextActiveKeys.add(key)
    }

    for (const [key, rect] of Array.from(this.activeRects.entries())) {
      if (!nextActiveKeys.has(key)) {
        this.pushFinalizedRect(rect)
        this.activeRects.delete(key)
      }
    }

    this.stats.mergeRowIndex = this.mergeRowIndex
  }

  override getOutput() {
    return {
      coverageRects: this.coverageRects,
      placed: this.input.placed,
      xs: this.input.xs,
      ys: this.input.ys,
      layerCount: this.input.layerCount,
    }
  }

  private pushFinalizedRect(rect: ActiveRect) {
    const rect3d = activeRectToRect3d(rect, this.input.layerCount)
    const split = this.splitRectByAspect(rect3d)
    if (split.length === 0) return
    this.coverageRects.push(...split)
    this.lastMergedRects.push(...split)
  }

  private splitRectByAspect(rect: Rect3d): Rect3d[] {
    const width = rect.maxX - rect.minX
    const height = rect.maxY - rect.minY
    if (!Number.isFinite(width) || !Number.isFinite(height)) return []
    if (width <= 0 || height <= 0) return []
    const minSizeEps = 1e-6
    if (width < minSizeEps || height < minSizeEps) return []

    const maxAspectRatio = this.input.maxAspectRatio
    if (maxAspectRatio == null || maxAspectRatio <= 0) return [rect]

    const ratio = Math.max(width / height, height / width)
    if (ratio <= maxAspectRatio) return [rect]

    if (width >= height) {
      const maxWidth = maxAspectRatio * height
      if (!Number.isFinite(maxWidth) || maxWidth <= 0) return []
      const parts = Math.max(1, Math.ceil(width / maxWidth))
      if (parts > 10000) return []
      const step = width / parts
      return Array.from({ length: parts }, (_, index) => {
        const minX = rect.minX + index * step
        const maxX =
          index === parts - 1 ? rect.maxX : rect.minX + (index + 1) * step
        return {
          ...rect,
          minX,
          maxX,
        }
      })
    }

    const maxHeight = maxAspectRatio * width
    if (!Number.isFinite(maxHeight) || maxHeight <= 0) return []
    const parts = Math.max(1, Math.ceil(height / maxHeight))
    if (parts > 10000) return []
    const step = height / parts
    return Array.from({ length: parts }, (_, index) => {
      const minY = rect.minY + index * step
      const maxY =
        index === parts - 1 ? rect.maxY : rect.minY + (index + 1) * step
      return {
        ...rect,
        minY,
        maxY,
      }
    })
  }

  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const lines: NonNullable<GraphicsObject["lines"]> = []
    const texts: NonNullable<GraphicsObject["texts"]> = []

    addSourcePlacements(rects, this.input.placed)
    addGridLines(lines, this.input.xs, this.input.ys)
    addRect3dOverlays(rects, this.coverageRects, "coverage")
    addActiveRects(
      rects,
      Array.from(this.activeRects.values()),
      this.input.layerCount,
    )
    addRect3dOverlays(rects, this.lastMergedRects, "merged")

    addInfoText(
      texts,
      this.input.xs,
      this.input.ys,
      [
        `phase: merge`,
        `row: ${this.mergeRowIndex}/${Math.max(0, this.input.ys.length - 1)}`,
        `coverage rects: ${this.coverageRects.length}`,
      ].join("\n"),
    )

    return {
      title: "Coverage Partition - Merge",
      coordinateSystem: "cartesian",
      rects,
      points: [],
      lines,
      texts,
    }
  }
}
