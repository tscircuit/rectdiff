# Gap-fill board bounds: original failure and fix

The existing `simplified-out-of-bounds-example.json` has a rectangular board with
minimum Y = -6 mm and a top-layer obstacle outside its lower-left corner.
Before the fix, the grid stage respected the board, but the gap-fill stage received
no rectangular bounds. It searched outward until it met a mesh node. The external
obstacle became that stopping point: `new-cmn_0-0` reached Y = -7.275436 mm,
1.275436 mm outside the board. With no outline, no board-void rectangles stopped it.

![Corrected output: no generated node crosses the blue board edge](../../tests/__snapshots__/simplified-out-of-bounds-example.snap.svg)

Blue is the physical board, gray is existing mesh, green is generated mesh, red is
generated mesh crossing the lower edge, and purple is the external input obstacle.
The input obstacle remains visible intentionally: this bug is about *generated*
routing space, not rejecting external input obstacles.

Run `bun test tests/simplified-out-of-bounds-example.test.ts`. The reproduction
commit asserted the original incorrect coordinate. The current test checks
containment within all four board bounds and records the corrected fixed-viewport
SVG above. The before image remains available in reproduction PR #149.

## Corrected behavior

The fix passes `SimpleRouteJson.bounds` through every gap-fill pass. Each seed
edge is clipped to its portion inside the board, and expansion stops at the nearer
of the boundary or an existing blocker (including outline-clearance voids). A
boundary also closes an empty gap when no obstacle exists. Standalone gap-fill
callers may omit bounds to retain their previous behavior.

For this fixture the initial grid already fills the board. The old generated node
is entirely outside it, so the corrected snapshot contains no generated node;
all original grid nodes, including the external obstacle, are preserved. Separate
directional tests verify that valid interior gaps still generate new space, plus
recursive passes, seed clipping, blocker avoidance, and outline clearance.

The fix assertion checks every generated node against all four bounds. The seven
other updated snapshots reflect boundary-limited gap filling in existing routing
fixtures. Regenerate with `BUN_UPDATE_SNAPSHOTS=1 bun test`, then verify with plain
`bun test` and `bunx tsc --noEmit`.

## Scope

This change bounds newly generated gap-fill nodes to the physical rectangle. It
does not clip preserved input obstacles. Outline-based board-edge clearance
continues to be enforced through void blockers. `minBoardEdgeClearance` on a board
with no outline is an existing separate limitation: the grid stage already fills
the physical bounds instead of insetting them, before gap filling runs. This fix
does not claim to solve that clearance issue.
