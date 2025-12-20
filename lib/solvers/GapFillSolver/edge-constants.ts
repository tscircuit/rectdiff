/**
 * The four normalized edges of a rect
 */
export const EDGES = [
  {
    facingDirection: "x-",
    dx: -1,
    dy: 0,
    startX: -0.5,
    startY: 0.5,
    endX: -0.5,
    endY: -0.5,
  },
  {
    facingDirection: "x+",
    dx: 1,
    dy: 0,
    startX: 0.5,
    startY: 0.5,
    endX: 0.5,
    endY: -0.5,
  },
  {
    facingDirection: "y-",
    dx: 0,
    dy: -1,
    startX: -0.5,
    startY: -0.5,
    endX: 0.5,
    endY: -0.5,
  },
  {
    facingDirection: "y+",
    dx: 0,
    dy: 1,
    startX: 0.5,
    startY: 0.5,
    endX: -0.5,
    endY: 0.5,
  },
] as const
