# Duplicate outer-layer promotions

The input consists of two identical 4-by-4 free rectangles: `top` on layer 0 and
`bottom` on layer 3. Copper pours cover both intermediate layers, making each
rectangle eligible for promotion using the other as opposite-layer support.

The current merge loop independently promotes both to `[0, 3]`. Their output
footprints coincide, so each outer layer contains two free nodes representing
32 square units over a physical region of only 16 square units. Downstream
capacity graphs therefore receive duplicate free space.

The snapshot shows input on the left and output on the right, with top and
bottom layers in separate rows. Blue is the original `top` node and red is
`bottom`; blended output rectangles and the node/area labels expose the overlap.
Panels are translated for display; the actual rectangles all occupy `[0,4]²`.

The test deliberately asserts the current incorrect result so this reproduction
PR passes without changing production code. The expected corrected behavior is
one `[0, 3]` node with area 16 on each outer layer.

```sh
bun test tests/solver/duplicate-outer-promotions/duplicate-outer-promotions.test.ts
```
