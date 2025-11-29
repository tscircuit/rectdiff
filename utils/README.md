# Project Utilities

This directory contains global utility functions that can be reused across different parts of the application.

## Geometry

### `rectsOverlap(a: XYRect, b: XYRect): boolean`

- **Description:** Checks if two rectangles overlap.
- **Parameters:**
  - `a`: The first rectangle (`XYRect`).
  - `b`: The second rectangle (`XYRect`).
- **Returns:** `true` if the rectangles overlap, `false` otherwise.

### `rectsEqual(a: XYRect, b: XYRect): boolean`

- **Description:** Checks if two rectangles are equal within a small tolerance (EPS).
- **Parameters:**
  - `a`: The first rectangle (`XYRect`).
  - `b`: The second rectangle (`XYRect`).
- **Returns:** `true` if the rectangles are equal, `false` otherwise.
