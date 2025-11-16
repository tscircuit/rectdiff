import { BaseSolver } from "@tscircuit/solver-utils"
import type { SimpleRouteJson } from "../types/srj-types"
import type { GraphicsObject } from "graphics-debug"
import type { CapacityMeshNode } from "../types/capacity-mesh-types"

/**
 * Internal 3D rect types used by the exact difference solver.
 */
type Rect3d = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  zLayers: number[] // integer z indices (half-open handled in Box below)
}

type Box = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  z0: number // inclusive
  z1: number // exclusive
}

type SolveResult = {
  boxes: Box[]
  rects: Rect3d[]
  score: number
  orderUsed: string
  totalFreeVolume: number
}

const EPS_DEFAULT = 1e-9

function almostEq(a: number, b: number, eps: number) {
  return Math.abs(a - b) <= eps
}
function gt(a: number, b: number, eps: number) {
  return a > b + eps
}
function intersect1D(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  eps: number,
): [number, number] | null {
  const lo = Math.max(a0, b0)
  const hi = Math.min(a1, b1)
  return gt(hi, lo, eps) ? [lo, hi] : null
}
function nonEmptyBox(b: Box, eps: number) {
  return gt(b.maxX, b.minX, eps) && gt(b.maxY, b.minY, eps) && b.z1 - b.z0 > 0
}
function ensureContiguous(z: number[]) {
  const zs = [...new Set(z)].sort((a, b) => a - b)
  for (let i = 1; i < zs.length; i++) {
    if (zs[i] !== zs[i - 1] + 1) {
      throw new Error(
        `zLayers must be contiguous integers: ${JSON.stringify(z)}`,
      )
    }
  }
  return zs
}
function toBoxFromRoot(root: Rect3d): Box {
  const z = ensureContiguous(root.zLayers)
  return {
    minX: root.minX,
    minY: root.minY,
    maxX: root.maxX,
    maxY: root.maxY,
    z0: z[0],
    z1: z[z.length - 1] + 1,
  }
}
function toBoxFromCutout(c: Rect3d, rootZs: Set<number>): Box | null {
  const filtered = [...new Set(c.zLayers)]
    .filter((z) => rootZs.has(z))
    .sort((a, b) => a - b)
  if (filtered.length === 0) return null
  const zs = ensureContiguous(filtered)
  return {
    minX: c.minX,
    minY: c.minY,
    maxX: c.maxX,
    maxY: c.maxY,
    z0: zs[0],
    z1: zs[zs.length - 1] + 1,
  }
}
function intersects(a: Box, b: Box, eps: number) {
  return (
    intersect1D(a.minX, a.maxX, b.minX, b.maxX, eps) &&
    intersect1D(a.minY, a.maxY, b.minY, b.maxY, eps) &&
    Math.min(a.z1, b.z1) > Math.max(a.z0, b.z0)
  )
}
function subtractBox(A: Box, B: Box, eps: number): Box[] {
  if (!intersects(A, B, eps)) return [A]
  const Xi = intersect1D(A.minX, A.maxX, B.minX, B.maxX, eps)
  const Yi = intersect1D(A.minY, A.maxY, B.minY, B.maxY, eps)
  const Z0 = Math.max(A.z0, B.z0)
  const Z1 = Math.min(A.z1, B.z1)
  if (!Xi || !Yi || !(Z1 > Z0)) return [A]

  const [X0, X1] = Xi
  const [Y0, Y1] = Yi
  const out: Box[] = []

  // Left slab
  if (gt(X0, A.minX, eps))
    out.push({
      minX: A.minX,
      maxX: X0,
      minY: A.minY,
      maxY: A.maxY,
      z0: A.z0,
      z1: A.z1,
    })
  // Right slab
  if (gt(A.maxX, X1, eps))
    out.push({
      minX: X1,
      maxX: A.maxX,
      minY: A.minY,
      maxY: A.maxY,
      z0: A.z0,
      z1: A.z1,
    })

  // Middle X range -> split along Y
  const midX0 = Math.max(A.minX, X0)
  const midX1 = Math.min(A.maxX, X1)

  // Front (lower Y)
  if (gt(Y0, A.minY, eps))
    out.push({
      minX: midX0,
      maxX: midX1,
      minY: A.minY,
      maxY: Y0,
      z0: A.z0,
      z1: A.z1,
    })
  // Back (upper Y)
  if (gt(A.maxY, Y1, eps))
    out.push({
      minX: midX0,
      maxX: midX1,
      minY: Y1,
      maxY: A.maxY,
      z0: A.z0,
      z1: A.z1,
    })

  // Center X,Y -> split along Z
  const midY0 = Math.max(A.minY, Y0)
  const midY1 = Math.min(A.maxY, Y1)

  if (Z0 > A.z0)
    out.push({
      minX: midX0,
      maxX: midX1,
      minY: midY0,
      maxY: midY1,
      z0: A.z0,
      z1: Z0,
    })
  if (A.z1 > Z1)
    out.push({
      minX: midX0,
      maxX: midX1,
      minY: midY0,
      maxY: midY1,
      z0: Z1,
      z1: A.z1,
    })

  return out.filter((b) => nonEmptyBox(b, eps))
}
function subtractCutoutFromList(boxes: Box[], cutout: Box, eps: number) {
  const out: Box[] = []
  for (const b of boxes) {
    if (intersects(b, cutout, eps)) {
      const parts = subtractBox(b, cutout, eps)
      for (const p of parts) out.push(p)
    } else {
      out.push(b)
    }
  }
  return out
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function subtractAll(rootBox: Box, cutoutBoxes: Box[], eps: number, seed = 0) {
  const rnd = mulberry32(seed)
  const cuts = [...cutoutBoxes].sort(
    (a, b) =>
      a.z0 - b.z0 ||
      a.z1 - b.z1 ||
      a.minY - b.minY ||
      a.minX - b.minX ||
      a.maxX - b.maxX ||
      a.maxY - b.maxY,
  )
  if (seed !== 0) {
    for (let i = cuts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      const tmp = cuts[i]
      cuts[i] = cuts[j]
      cuts[j] = tmp
    }
  }
  let free = [rootBox]
  for (const c of cuts) free = subtractCutoutFromList(free, c, eps)
  return free
}
function mergeAlongAxis(boxes: Box[], axis: "X" | "Y" | "Z", eps: number) {
  if (boxes.length <= 1) return boxes
  const groups = new Map<string, Box[]>()
  const R = (v: number) => v.toFixed(12)

  const keyX = (b: Box) => `y:${R(b.minY)}-${R(b.maxY)}|z:${b.z0}-${b.z1}`
  const keyY = (b: Box) => `x:${R(b.minX)}-${R(b.maxX)}|z:${b.z0}-${b.z1}`
  const keyZ = (b: Box) =>
    `x:${R(b.minX)}-${R(b.maxX)}|y:${R(b.minY)}-${R(b.maxY)}`
  const keyFn = axis === "X" ? keyX : axis === "Y" ? keyY : keyZ

  for (const b of boxes) {
    const k = keyFn(b)
    const arr = groups.get(k)
    if (arr) arr.push(b)
    else groups.set(k, [b])
  }

  const out: Box[] = []
  for (const arr of groups.values()) {
    if (axis === "X") {
      arr.sort((a, b) => a.minX - b.minX || a.maxX - b.maxX)
      let cur = arr[0]
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i]
        if (almostEq(cur.maxX, n.minX, eps)) {
          cur = { ...cur, maxX: n.maxX }
        } else {
          out.push(cur)
          cur = n
        }
      }
      out.push(cur)
    } else if (axis === "Y") {
      arr.sort((a, b) => a.minY - b.minY || a.maxY - b.maxY)
      let cur = arr[0]
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i]
        if (almostEq(cur.maxY, n.minY, eps)) {
          cur = { ...cur, maxY: n.maxY }
        } else {
          out.push(cur)
          cur = n
        }
      }
      out.push(cur)
    } else {
      arr.sort((a, b) => a.z0 - b.z0 || a.z1 - b.z1)
      let cur = arr[0]
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i]
        if (cur.z1 === n.z0) {
          cur = { ...cur, z1: n.z1 }
        } else {
          out.push(cur)
          cur = n
        }
      }
      out.push(cur)
    }
  }
  return out
}
function coalesce(
  boxes: Box[],
  order: Array<"X" | "Y" | "Z">,
  eps: number,
  maxCycles = 4,
) {
  let cur = boxes.slice()
  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const prevLen = cur.length
    for (const ax of order) cur = mergeAlongAxis(cur, ax, eps)
    if (cur.length === prevLen) break
  }
  return cur
}
function permutations<T>(arr: T[]) {
  const res: T[][] = []
  const used = Array(arr.length).fill(false)
  const curr: T[] = []
  const backtrack = () => {
    if (curr.length === arr.length) {
      res.push(curr.slice())
      return
    }
    for (let i = 0; i < arr.length; i++) {
      if (used[i]) continue
      used[i] = true
      curr.push(arr[i])
      backtrack()
      curr.pop()
      used[i] = false
    }
  }
  backtrack()
  return res
}
function scoreBoxes(boxes: Box[], thickness: number, p: number) {
  let s = 0
  for (const b of boxes) {
    const dx = b.maxX - b.minX
    const dy = b.maxY - b.minY
    const dz = (b.z1 - b.z0) * thickness
    const vol = dx * dy * dz
    s += Math.pow(vol, p)
  }
  return s
}
function totalVolume(boxes: Box[], thickness: number) {
  let v = 0
  for (const b of boxes) {
    v += (b.maxX - b.minX) * (b.maxY - b.minY) * (b.z1 - b.z0) * thickness
  }
  return v
}
function boxToRect3d(b: Box): Rect3d {
  const zLayers: number[] = []
  for (let z = b.z0; z < b.z1; z++) zLayers.push(z)
  return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, zLayers }
}
function solveNoDiscretization(
  problem: { rootRect: Rect3d; cutouts: Rect3d[] },
  options: {
    Z_LAYER_THICKNESS: number
    p: number
    order: "AUTO" | "X,Y,Z" | "X,Z,Y" | "Y,X,Z" | "Y,Z,X" | "Z,X,Y" | "Z,Y,X"
    maxCycles: number
    eps: number
    seed: number
  },
): SolveResult {
  const { Z_LAYER_THICKNESS, p, order, maxCycles, eps, seed } = options
  const rootZs = new Set(problem.rootRect.zLayers)
  const rootBox = toBoxFromRoot(problem.rootRect)
  const cutoutBoxes = problem.cutouts
    .map((c) => toBoxFromCutout(c, rootZs))
    .filter((b): b is Box => !!b)

  if (!nonEmptyBox(rootBox, eps)) {
    throw new Error("Root box is empty.")
  }

  const diffBoxes = subtractAll(rootBox, cutoutBoxes, eps, seed)
  const orders =
    order === "AUTO"
      ? permutations<"X" | "Y" | "Z">(["X", "Y", "Z"])
      : [order.split(",") as Array<"X" | "Y" | "Z">]

  let best: Box[] | null = null
  let bestScore = -Infinity
  let bestOrder: string | null = null
  for (const ord of orders) {
    const merged = coalesce(diffBoxes, ord, eps, maxCycles)
    const sc = scoreBoxes(merged, Z_LAYER_THICKNESS, p)
    if (sc > bestScore) {
      best = merged
      bestScore = sc
      bestOrder = ord.join(",")
    }
  }
  const boxes = best ?? diffBoxes
  return {
    boxes,
    rects: boxes.map(boxToRect3d),
    score: bestScore,
    orderUsed: bestOrder ?? "X,Y,Z",
    totalFreeVolume: totalVolume(boxes, Z_LAYER_THICKNESS),
  }
}

/**
 * Utility: canonical layer ordering for deterministic z indexing.
 *  top -> innerN (ascending) -> bottom -> other (lexicographic)
 */
function layerSortKey(name: string) {
  if (name.toLowerCase() === "top") return -1_000_000
  if (name.toLowerCase() === "bottom") return 1_000_000
  const m = /^inner(\d+)$/i.exec(name)
  if (m) return parseInt(m[1]!, 10) || 0
  return 100 + name.toLowerCase().charCodeAt(0)
}
function canonicalizeLayerOrder(names: string[]) {
  return [...new Set(names)].sort((a, b) => {
    const ka = layerSortKey(a)
    const kb = layerSortKey(b)
    if (ka !== kb) return ka - kb
    return a.localeCompare(b)
  })
}
function contiguousRuns(nums: number[]) {
  const zs = [...new Set(nums)].sort((a, b) => a - b)
  if (zs.length === 0) return [] as number[][]
  const groups: number[][] = []
  let run: number[] = [zs[0]]
  for (let i = 1; i < zs.length; i++) {
    if (zs[i] === zs[i - 1] + 1) run.push(zs[i])
    else {
      groups.push(run)
      run = [zs[i]]
    }
  }
  groups.push(run)
  return groups
}
function toXYBoundsRect(
  center: { x: number; y: number },
  width: number,
  height: number,
) {
  const hw = width / 2
  const hh = height / 2
  return {
    minX: center.x - hw,
    maxX: center.x + hw,
    minY: center.y - hh,
    maxY: center.y + hh,
  }
}

export class RectDiffSolver extends BaseSolver {
  private srj: SimpleRouteJson
  private layerNames: string[] = []
  private layerIndexByName = new Map<string, number>()
  private topLayerIndex = 0
  private result: SolveResult | null = null
  private meshNodes: CapacityMeshNode[] = []

  constructor(params: { simpleRouteJson: SimpleRouteJson }) {
    super()
    this.srj = params.simpleRouteJson

    // Discover & index layers deterministically
    const found = new Set<string>()
    for (const ob of this.srj.obstacles ?? []) {
      for (const l of ob.layers ?? []) found.add(l)
    }
    for (const conn of this.srj.connections ?? []) {
      for (const pt of conn.pointsToConnect ?? []) {
        if (pt.layer) found.add(pt.layer)
      }
    }
    if (found.size === 0) found.add("top")
    this.layerNames = canonicalizeLayerOrder([...found])
    this.layerNames.forEach((n, i) => this.layerIndexByName.set(n, i))
    this.topLayerIndex =
      this.layerIndexByName.get("top") ?? (this.layerNames.length ? 0 : 0)
  }

  /** Perform the whole solve in a single step for now (keeps snapshots deterministic). */
  override _step(): void {
    try {
      // Build Problem: root + cutouts (split into contiguous z runs)
      const rootRect: Rect3d = {
        minX: this.srj.bounds.minX,
        minY: this.srj.bounds.minY,
        maxX: this.srj.bounds.maxX,
        maxY: this.srj.bounds.maxY,
        zLayers: Array.from({ length: this.layerNames.length }, (_, i) => i),
      }

      const cutouts: Rect3d[] = []
      for (const ob of this.srj.obstacles ?? []) {
        // Only rectangles and ovals are supported; ovals -> bounding rect
        if (ob.type !== "rect" && ob.type !== "oval") continue
        const xy = toXYBoundsRect(ob.center, ob.width, ob.height)

        // Map obstacle's layer strings to z indices and split across contiguous runs
        const zIdxs = (ob.layers ?? [])
          .map((ln) => this.layerIndexByName.get(ln))
          .filter((v): v is number => typeof v === "number")

        for (const run of contiguousRuns(zIdxs)) {
          cutouts.push({
            ...xy,
            zLayers: run.slice(),
          })
        }
      }

      // Solve with defaults (thickness=1 unit, exponent p=2)
      const res = solveNoDiscretization(
        { rootRect, cutouts },
        {
          Z_LAYER_THICKNESS: 1,
          p: 2,
          order: "AUTO",
          maxCycles: 6,
          eps: EPS_DEFAULT,
          seed: 0,
        },
      )

      this.result = res

      // Produce CapacityMeshNodes: one per layer slice of each merged box
      const nodes: CapacityMeshNode[] = []
      let nid = 0
      for (const b of res.boxes) {
        const dx = b.maxX - b.minX
        const dy = b.maxY - b.minY
        const cx = (b.minX + b.maxX) / 2
        const cy = (b.minY + b.maxY) / 2
        const availableZ: number[] = []
        for (let z = b.z0; z < b.z1; z++) availableZ.push(z)

        for (let z = b.z0; z < b.z1; z++) {
          const lname = this.layerNames[z] ?? `layer_${z}`
          nodes.push({
            capacityMeshNodeId: `node_${nid++}`,
            center: { x: cx, y: cy },
            width: dx,
            height: dy,
            layer: lname,
            availableZ: availableZ.slice(),
          })
        }
      }
      this.meshNodes = nodes

      ;(this as any).solved = true
    } catch (err: any) {
      ;(this as any).failed = true
      ;(this as any).errorMessage = String(err?.message ?? err)
    }
  }

  override getOutput(): { meshNodes: CapacityMeshNode[] } {
    return { meshNodes: this.meshNodes }
  }

  /**
   * 2D visualization (SVG) of the top layer:
   *  - Board outline
   *  - Obstacles on the top layer (red)
   *  - Free rectangles on the top layer (green) derived from 3D result
   */
  override visualize(): GraphicsObject {
    const rects: NonNullable<GraphicsObject["rects"]> = []
    const topZ = this.topLayerIndex

    // Board outline
    rects.push({
      center: {
        x: (this.srj.bounds.minX + this.srj.bounds.maxX) / 2,
        y: (this.srj.bounds.minY + this.srj.bounds.maxY) / 2,
      },
      width: this.srj.bounds.maxX - this.srj.bounds.minX,
      height: this.srj.bounds.maxY - this.srj.bounds.minY,
      fill: "none",
      stroke: "#111827",
      label: "board",
    })

    // Obstacles (top layer only) — red translucent
    for (const ob of this.srj.obstacles ?? []) {
      if (
        (ob.type === "rect" || ob.type === "oval") &&
        (ob.layers ?? []).includes(this.layerNames[topZ])
      ) {
        rects.push({
          center: { x: ob.center.x, y: ob.center.y },
          width: ob.width,
          height: ob.height,
          fill: "#fee2e2",
          stroke: "#ef4444",
          layer: this.layerNames[topZ],
          label: ["obstacle", ob.zLayers?.join(",")].join("\n"),
        })
      }
    }

    // Free rectangles on the top layer — green translucent
    if (this.result) {
      const freeTop: {
        x: number
        y: number
        w: number
        h: number
      }[] = []
      for (const b of this.result.boxes) {
        if (b.z0 <= topZ && topZ < b.z1) {
          freeTop.push({
            x: (b.minX + b.maxX) / 2,
            y: (b.minY + b.maxY) / 2,
            w: b.maxX - b.minX,
            h: b.maxY - b.minY,
          })
        }
      }
      // deterministic ordering
      freeTop
        .sort((a, b) => a.x - b.x || a.y - b.y || a.w - b.w || a.h - b.h)
        .forEach((r) =>
          rects.push({
            center: { x: r.x, y: r.y },
            width: r.w,
            height: r.h,
            fill: "#d1fae5",
            stroke: "#10b981",
            layer: this.layerNames[topZ],
            label: "free",
          }),
        )
    }

    return {
      title: `RectDiff (layer: ${this.layerNames[topZ] ?? "top"})`,
      coordinateSystem: "cartesian",
      rects,
    }
  }
}
