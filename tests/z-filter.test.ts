import { expect, test } from "bun:test"
import { matchesExactZFilter, parseZFilterInput } from "../lib/utils/z-filter"

test("parseZFilterInput parses a single z", () => {
  expect(parseZFilterInput("1")).toEqual([1])
})

test("parseZFilterInput parses multiple z values", () => {
  expect(parseZFilterInput("1, 2,3")).toEqual([1, 2, 3])
})

test("parseZFilterInput normalizes duplicates and ordering", () => {
  expect(parseZFilterInput("3,1,3,2")).toEqual([1, 2, 3])
})

test("parseZFilterInput returns null for empty input", () => {
  expect(parseZFilterInput("  ")).toBeNull()
})

test("parseZFilterInput returns null for invalid input", () => {
  expect(parseZFilterInput("1,a")).toBeNull()
})

test("matchesExactZFilter only matches exact single-layer selections", () => {
  expect(matchesExactZFilter([1], [1])).toBe(true)
  expect(matchesExactZFilter([1, 2], [1])).toBe(false)
})

test("matchesExactZFilter only matches exact shared-layer selections", () => {
  expect(matchesExactZFilter([1, 2, 3], [1, 2, 3])).toBe(true)
  expect(matchesExactZFilter([1, 2], [1, 2, 3])).toBe(false)
  expect(matchesExactZFilter([1, 2, 3, 4], [1, 2, 3])).toBe(false)
})
