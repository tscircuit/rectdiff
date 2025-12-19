import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import { GapFillSolver, type GapFillSolverInput } from "./GapFillSolver"
import { visualizeBaseState } from "./visualizeBaseState"

export interface GapFillSolverRepeaterInput extends GapFillSolverInput {
  numberOfGapFillLoops?: number
}

export class GapFillSolverRepeater extends BaseSolver {
  private numberOfGapFillLoops: number
  private currentLoop = 0
  private activeSubsolver: GapFillSolver | null = null
  private allFilledRects: any[] = []

  constructor(private input: GapFillSolverRepeaterInput) {
    super()
    this.numberOfGapFillLoops = input.numberOfGapFillLoops ?? 1
  }

  override _setup(): void {
    this.allFilledRects = []
    this.startNextIteration()
  }

  private startNextIteration(): void {
    if (this.currentLoop >= this.numberOfGapFillLoops) {
      this.solved = true
      return
    }

    this.activeSubsolver = new GapFillSolver({
      ...this.input,
      placedRects: [...this.input.placedRects, ...this.allFilledRects],
    })
    this.activeSubsolver._setup()
    this.currentLoop++
  }

  override _step(): void {
    if (!this.activeSubsolver) {
      this.solved = true
      return
    }

    if (this.activeSubsolver.solved) {
      const output = this.activeSubsolver.getOutput()
      this.allFilledRects.push(
        ...output.filledRects.map((node: any) => ({
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

  override getOutput(): { filledRects: CapacityMeshNode[] } {
    const filledRects: CapacityMeshNode[] = this.allFilledRects.map(
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

    return { filledRects: filledRects }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubsolver) {
      return this.activeSubsolver.visualize()
    }
    return visualizeBaseState(
      this.input.placedRects,
      this.input.obstaclesByLayer,
      `Gap Fill Manager (Iteration ${this.currentLoop}/${this.numberOfGapFillLoops})`,
    )
  }
}
