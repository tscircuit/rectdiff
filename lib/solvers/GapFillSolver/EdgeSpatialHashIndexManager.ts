import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import {
  EdgeSpatialHashIndex,
  type EdgeSpatialHashIndexInput,
} from "./EdgeSpatialHashIndex"
import { visualizeBaseState } from "./visualizeBaseState"

export interface EdgeSpatialHashIndexManagerInput
  extends EdgeSpatialHashIndexInput {
  repeatCount?: number
}

export class EdgeSpatialHashIndexManager extends BaseSolver {
  private input: EdgeSpatialHashIndexManagerInput
  private repeatCount: number
  private currentIteration: number = 0
  private activeSubsolver: EdgeSpatialHashIndex | null = null
  private allFilledRects: any[] = []

  constructor(input: EdgeSpatialHashIndexManagerInput) {
    super()
    this.input = input
    this.repeatCount = input.repeatCount ?? 1
  }

  override _setup(): void {
    this.currentIteration = 0
    this.allFilledRects = []
    this.startNextIteration()
  }

  private startNextIteration(): void {
    if (this.currentIteration >= this.repeatCount) {
      this.solved = true
      return
    }

    this.activeSubsolver = new EdgeSpatialHashIndex({
      ...this.input,
      placedRects: [...this.input.placedRects, ...this.allFilledRects],
    })
    this.activeSubsolver._setup()
    this.currentIteration++
  }

  override _step(): void {
    if (!this.activeSubsolver) {
      this.solved = true
      return
    }

    if (this.activeSubsolver.solved) {
      const output = this.activeSubsolver.getOutput()
      this.allFilledRects.push(
        ...output.meshNodes.map((node: any) => ({
          rect: {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
          },
          zLayers: node.availableZ,
        })),
      )
      this.startNextIteration()
      return
    }

    this.activeSubsolver._step()
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    const meshNodes: CapacityMeshNode[] = this.allFilledRects.map(
      (placed, index) => ({
        capacityMeshNodeId: `gap-fill-${index}`,
        x: placed.rect.x,
        y: placed.rect.y,
        center: {
          x: placed.rect.x + placed.rect.width / 2,
          y: placed.rect.y + placed.rect.height / 2,
        },
        width: placed.rect.width,
        height: placed.rect.height,
        availableZ: placed.zLayers,
        layer: placed.zLayers[0]?.toString() ?? "0",
      }),
    )

    return { meshNodes }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubsolver) {
      return this.activeSubsolver.visualize()
    }
    return visualizeBaseState(
      this.input.placedRects,
      this.input.obstaclesByLayer,
      `Gap Fill Manager (Iteration ${this.currentIteration}/${this.repeatCount})`,
    )
  }
}
