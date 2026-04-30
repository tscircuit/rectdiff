import type { XYRect } from "../../rectdiff-types"

/**
 * Return the area of a rectangle.
 * Width and height are multiplied directly.
 */
export const rectArea = ({ rect }: { rect: XYRect }) => rect.width * rect.height
