# Promotion overlaps an unchanged multilayer support node

This minimal four-layer case starts with two disjoint nodes: a 4-by-4 candidate
on top `[0]`, and an identically positioned support node on `[1, 3]`. Copper
pours cover both intermediate layers, satisfying the solver's transit checks.
The support is free, so it satisfies opposite-layer coverage. However, it is
not a singleton outer node: the solver preserves it unchanged.

The current solver promotes the candidate to `[0, 3]` without accounting for
that preserved support. Their footprints now coincide on the bottom layer.
Bottom node area doubles from 16 to 32 even though the represented union is
still 16. The input has no same-layer overlaps; the output has one.

The snapshot separates input/output and top/bottom. Purple solid and green
dashed outlines expose both nodes in the bottom output panel; the area totals
and explicit layer lists make the coincident geometry unambiguous.

![Current failing geometry](__snapshots__/immutable-outer-overlap.snap.svg)

This reproduction deliberately asserts the current incorrect result so it can
land before the fix. A follow-up must reject this promotion, preserve both input
nodes on their original layers, and assert zero conflicts and unchanged area.
No production behavior changes in this reproduction.

Run: `bun test tests/solver/immutable-outer-overlap/immutable-outer-overlap.test.ts`
