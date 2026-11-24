export function normalizeZValues(zValues: number[]): number[] {
  return [...new Set(zValues)].sort((a, b) => a - b)
}

export function parseZFilterInput(input: string): number[] | null {
  const zValues: number[] = []
  const groups = input.split(",")

  for (const [index, group] of groups.entries()) {
    const tokens = group.split(/\s+/).filter((token) => token.length > 0)
    if (tokens.length === 0) {
      // Only a trailing comma may leave the final group empty
      if (index === groups.length - 1 && index > 0) continue
      return null
    }
    for (const token of tokens) {
      if (!/^\d+$/.test(token)) return null
      zValues.push(Number(token))
    }
  }

  if (zValues.length === 0) return null

  return normalizeZValues(zValues)
}

export function matchesExactZFilter(
  zValues: number[],
  selectedZValues: number[] | null,
): boolean {
  if (!selectedZValues) return true

  const normalized = normalizeZValues(zValues)
  if (normalized.length !== selectedZValues.length) return false

  return normalized.every((z, index) => z === selectedZValues[index])
}
