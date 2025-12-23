const OFFSET_DIR_MAP = {
  "x-": {
    x: -1,
    y: 0,
  },
  "x+": {
    x: 1,
    y: 0,
  },
  "y-": {
    x: 0,
    y: -1,
  },
  "y+": {
    x: 0,
    y: 1,
  },
} as const
/**
 * Visually offset a line by a given amount in a given direction
 */
export const visuallyOffsetLine = (
  line: Array<{ x: number; y: number }>,
  options: {
    dir: "x-" | "x+" | "y-" | "y+"
    amt: number
  },
) => {
  const { dir, amt } = options
  const offset = OFFSET_DIR_MAP[dir]
  return line.map((p) => ({
    x: p.x + offset.x * amt,
    y: p.y + offset.y * amt,
  }))
}
