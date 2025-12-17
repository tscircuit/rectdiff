// lib/solvers/BasePipelineSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils"

/**
 * Base class for solvers that operate in distinct phases/stages.
 * Each phase is a step function that returns the next phase or null if done.
 */
export abstract class BasePipelineSolver extends BaseSolver {
  protected abstract getCurrentPhase(): string | null
  protected abstract setPhase(phase: string | null): void
  protected abstract stepPhase(phase: string): string | null

  override _step() {
    const currentPhase = this.getCurrentPhase()
    if (!currentPhase) {
      this.solved = true
      return
    }

    const nextPhase = this.stepPhase(currentPhase)
    this.setPhase(nextPhase)
  }

  /**
   * Get the current phase name for visualization/stats.
   */
  getPhase(): string | null {
    return this.getCurrentPhase()
  }
}
