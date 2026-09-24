# Duplicate outer-layer promotions

The input consists of two identical 4-by-4 free rectangles: `top` on layer 0 and
`bottom` on layer 3. Copper pours cover both intermediate layers, making each
rectangle eligible for promotion using the other as opposite-layer support.

The previous merge loop independently promoted both to `[0, 3]`. Their output
footprints coincide, so each outer layer contains two free nodes representing
32 square units over a physical region of only 16 square units. Downstream
capacity graphs therefore receive duplicate free space.

The snapshot shows input on the left and output on the right, with top and
bottom layers in separate rows. Blue is the original `top` node and red is
`bottom`; blended output rectangles and the node/area labels expose the overlap.
Panels are translated for display; the actual rectangles all occupy `[0,4]²`.

The fixed loop checks every previously promoted footprint before accepting a
candidate. It emits one `[0, 3]` node with area 16 on each outer layer; the rejected
node is removed by normal residual subtraction. Updated assertions check this
result, reversed candidate order, nested residuals, edge-adjacent promotions,
same-layer disjointness, and area preservation. The snapshot now shows a single
blue output node per layer.

A scoped Lean proof of the acceptance invariant is in `proofs/DuplicatePromotion.lean`.
The proof does not cover the entire solver or unchanged multilayer nodes.

```sh
bun test tests/solver/duplicate-outer-promotions/duplicate-outer-promotions.test.ts
```
