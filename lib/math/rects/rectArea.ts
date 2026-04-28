import type { XYRect } from "../../rectdiff-types"

/**
 * Compute the 2D area of a rectangle.
 * The sparse multilayer solvers use this as their primary merge score.
 */
export const rectArea = ({ rect }: { rect: XYRect }) => rect.width * rect.height
