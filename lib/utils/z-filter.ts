export function normalizeZValues(zValues: number[]): number[] {
  return [...new Set(zValues)].sort((a, b) => a - b)
}

export function parseZFilterInput(input: string): number[] | null {
  const zValues: number[] = []
  let current = ""

  for (const char of input) {
    if (char >= "0" && char <= "9") {
      current += char
      continue
    }

    if (char === "," || char === " " || char === "\t" || char === "\n") {
      if (char === ",") {
        if (current === "") return null
        zValues.push(Number(current))
        current = ""
      }
      continue
    }

    return null
  }

  if (current !== "") zValues.push(Number(current))
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
