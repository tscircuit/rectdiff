import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import type { Rect3d } from "lib/rectdiff-types"
import { rectsToMeshNodes } from "../RectDiffExpansionSolver/rectsToMeshNodes"
import type { ObstacleEntry } from "./shared"
import { addInfoText, addRect3dOverlays } from "./visualization"

export type ObstacleInjectionSolverInput = {
  coverageRects: Rect3d[]
  mergedObstacles: ObstacleEntry[]
  maxAspectRatio?: number | null
}

export class ObstacleInjectionSolver extends BaseSolver {
  private obstacleRects: Rect3d[] = []
  private meshNodes: CapacityMeshNode[] = []
  private obstacleIndex = 0
  private lastAddedObstacle: Rect3d | null = null

  constructor(private input: ObstacleInjectionSolverInput) {
    super()
  }

  override _setup() {
    this.stats = { obstacleIndex: 0 }
  }

  override _step() {
    this.lastAddedObstacle = null

    if (this.obstacleIndex >= this.input.mergedObstacles.length) {
      this.meshNodes = this.splitMeshNodesByAspect(
        rectsToMeshNodes([...this.input.coverageRects, ...this.obstacleRects]),
      )
      this.solved = true
      return
    }

    const obstacle = this.input.mergedObstacles[this.obstacleIndex++]!
    const rect3d: Rect3d = {
      minX: obstacle.rect.x,
      minY: obstacle.rect.y,
      maxX: obstacle.rect.x + obstacle.rect.width,
      maxY: obstacle.rect.y + obstacle.rect.height,
      zLayers: obstacle.zLayers,
      isObstacle: true,
    }
    this.obstacleRects.push(rect3d)
    this.lastAddedObstacle = rect3d
    this.stats.obstacleIndex = this.obstacleIndex
  }

  override getOutput(): { meshNodes: CapacityMeshNode[]; rects: Rect3d[] } {
    const rects = [...this.input.coverageRects, ...this.obstacleRects]
    return {
      meshNodes: this.solved
        ? this.meshNodes
        : this.splitMeshNodesByAspect(rectsToMeshNodes(rects)),
      rects,
    }
  }

  private splitMeshNodesByAspect(
    nodes: CapacityMeshNode[],
  ): CapacityMeshNode[] {
    const maxAspectRatio = this.input.maxAspectRatio
    if (maxAspectRatio == null || maxAspectRatio <= 0) return nodes

    const minSizeEps = 1e-6
    const out: CapacityMeshNode[] = []

    for (const node of nodes) {
      const width = node.width
      const height = node.height
      if (!Number.isFinite(width) || !Number.isFinite(height)) continue
      if (width < minSizeEps || height < minSizeEps) continue

      const ratio = Math.max(width / height, height / width)
      if (ratio <= maxAspectRatio) {
        out.push(node)
        continue
      }

      if (width >= height) {
        const maxWidth = maxAspectRatio * height
        if (!Number.isFinite(maxWidth) || maxWidth <= 0) continue
        const parts = Math.max(1, Math.ceil(width / maxWidth))
        if (parts > 10000) continue
        const step = width / parts
        const minX = node.center.x - width / 2

        for (let index = 0; index < parts; index += 1) {
          const partMinX = minX + index * step
          const partMaxX =
            index === parts - 1 ? minX + width : minX + (index + 1) * step
          const partWidth = partMaxX - partMinX
          out.push({
            ...node,
            capacityMeshNodeId: `${node.capacityMeshNodeId}-s${index}`,
            center: { x: (partMinX + partMaxX) / 2, y: node.center.y },
            width: partWidth,
          })
        }
        continue
      }

      const maxHeight = maxAspectRatio * width
      if (!Number.isFinite(maxHeight) || maxHeight <= 0) continue
      const parts = Math.max(1, Math.ceil(height / maxHeight))
      if (parts > 10000) continue
      const step = height / parts
      const minY = node.center.y - height / 2

      for (let index = 0; index < parts; index += 1) {
        const partMinY = minY + index * step
        const partMaxY =
          index === parts - 1 ? minY + height : minY + (index + 1) * step
        const partHeight = partMaxY - partMinY
        out.push({
          ...node,
          capacityMeshNodeId: `${node.capacityMeshNodeId}-s${index}`,
          center: { x: node.center.x, y: (partMinY + partMaxY) / 2 },
          height: partHeight,
        })
      }
    }

    return out
  }

  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const texts: NonNullable<GraphicsObject["texts"]> = []

    addRect3dOverlays(rects, this.input.coverageRects, "coverage")
    addRect3dOverlays(rects, this.obstacleRects, "obstacle")
    if (this.lastAddedObstacle) {
      addRect3dOverlays(rects, [this.lastAddedObstacle], "add obstacle")
    }

    addInfoText(
      texts,
      this.input.coverageRects.map((r) => r.minX),
      this.input.coverageRects.map((r) => r.minY),
      [
        `phase: obstacles`,
        `obstacles: ${this.obstacleIndex}/${this.input.mergedObstacles.length}`,
        `coverage rects: ${this.input.coverageRects.length}`,
      ].join("\n"),
    )

    return {
      title: "Coverage Partition - Obstacles",
      coordinateSystem: "cartesian",
      rects,
      points: [],
      lines: [],
      texts,
    }
  }
}
