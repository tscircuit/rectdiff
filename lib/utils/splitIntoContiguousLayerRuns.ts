/** Split zLayers into contiguous runs. */
export function splitIntoContiguousLayerRuns(zLayers: number[]): number[][] {
  if (zLayers.length === 0) {
    return []
  }

  const sorted = Array.from(new Set(zLayers)).sort((a, b) => a - b)
  const out: number[][] = []
  let current = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const z = sorted[i]!
    const prev = current[current.length - 1]!

    if (z === prev + 1) {
      current.push(z)
      continue
    }

    out.push(current)
    current = [z]
  }

  out.push(current)
  return out
}
