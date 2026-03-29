This is an algorithm solver repo designed to be integrated into the tscircuit
autorouter.

It uses the SimpleRouteJson type as input (see lib/types/srj-types.ts)

We use svg snapshots to create visual snapshots as our primary method of
ensuring the algorithm works correctly. We use `export BUN_UPDATE_SNAPSHOTS=1`
and `bun test path/to/test.test.ts` to update the snapshots.

We use the `graphics-debug` package to turn `GraphicsObject` into SVGs using

```tsx
import { getSvgFromGraphicsObject } from "graphics-debug"
```

We use `cosmos` `*.page.tsx` files inside the `pages` directory to create
examples that can be debugged for a human.

We discovered the algorithm via `experiments/rect3d_visualizer.html` and we're
now formalizing it into a solver pattern and binding to our normal types.

The `test-assets` directory contains assets for test, typically simple route
json files with test cases that can be importing into pages or tests.
