# Preserve unchanged outer-layer support during promotion

This minimal four-layer case starts with two disjoint nodes: a 4-by-4 candidate
on top `[0]`, and an identically positioned support node on `[1, 3]`. Copper
pours cover both intermediate layers, satisfying the solver's transit checks.
The support is free, so it satisfies opposite-layer coverage. However, it is
not a singleton outer node: the solver preserves it unchanged.

Previously the candidate promoted to `[0, 3]` over the unchanged support. Bottom
node area doubled from 16 to 32 despite a union area of 16, creating a same-layer
overlap from a disjoint input. The [reproduction PR](https://github.com/tscircuit/rectdiff/pull/150)
records the old output and explains its assertions.

The fix collects immutable footprints occupying either outer layer and rejects
any overlapping candidate before promotion. Both nodes retain their original
layers in this example, preserving area and disjointness. Rejected candidates
still participate in normal residual subtraction if another candidate promotes.

![Corrected geometry](__snapshots__/immutable-outer-overlap.snap.svg)

The four panels separate input/output and top/bottom. Green dashed outlines
identify the candidate; purple solid outlines identify unchanged support. Layer
lists, area sums, union areas, and the overlap counter show the corrected output.

Regressions cover identical support, the symmetric bottom-to-top case, partial
immutable support with an adjacent successful promotion, and an adjacent
immutable node that must not block promotion. Assertions check unchanged support,
no same-layer overlap, and preserved outer-layer area. The existing Arduino
inner1-power snapshot also updates because previously unsafe promotions are
suppressed in that pipeline fixture.

This guard conservatively rejects a whole candidate; it does not split a
candidate into promotable pieces. Conflicts between two newly promoted mutable
nodes are a separate issue handled by another PR pair.

Run: `bun test tests/solver/immutable-outer-overlap/immutable-outer-overlap.test.ts`

Validation: 4 focused tests pass; `bunx tsc --noEmit` passes; full `bun test`
reports 79 passes, 1 skip, and no failures after updating the two snapshots.
