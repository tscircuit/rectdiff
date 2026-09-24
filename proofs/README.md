# Duplicate-promotion invariant

Run `cd proofs && lean DuplicatePromotion.lean` with elan installed. The toolchain
is pinned to Lean 4.19.0 and uses only bundled `Std`; no Mathlib, added axioms, or
`sorry` are needed.

The model mirrors the accepted-footprint guard in
`OuterLayerContainmentMergeSolver.processOuterLayerContainmentMerges`.
`select_preserves` proves that each newly accepted footprint is nonconflicting
with every prior accepted footprint, starting from any safe accepted list.
`select_safe` starts from an empty list; `clear_excludes` connects the Boolean
guard to each prior footprint; `select_origin` proves no candidates are invented.
Concrete examples show the old duplicate failure, the corrected output, and
acceptance of edge-adjacent rectangles.

This is a manually linked model, not an automatically extracted proof of
TypeScript. Candidates abstract away size, support, and copper-transit checks.
The TypeScript list appends and the model prepends, which does not change
checking every prior footprint. The generic theorem accepts any Boolean
conflict predicate; it does not verify floating-point arithmetic or EPS itself.
An additional exact integer geometry lemma connects nonoverlap to interior
disjointness for the examples only.

Residual subtraction, unchanged-node safety, board bounds, and complete pipeline
correctness are outside this proof. Runtime regressions also check area
preservation, residuals, and reversed candidate order.

## Unchanged outer-layer footprints

Run `cd proofs && lean OuterLayerPromotion.lean` for the extended model. Its
`select_preserves` proves both nonconflict with prior accepted candidates and
nonconflict with immutable outer-layer footprints. `select_safe` specializes
this to an empty accepted list, and examples exercise immutable rejection as
well as duplicate rejection and edge adjacency.

This corresponds to the additional immutable-footprint guard: unchanged nodes
on either outer layer are collected before selection, and an overlapping
candidate is rejected. The same modeling limitations above apply. This extends
selection safety only; residual subtraction, area preservation, board bounds,
and the complete pipeline remain outside the formal claim.
