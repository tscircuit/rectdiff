import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import type { CapacityMeshNode } from "../lib/types/capacity-mesh-types"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

/** Minimal solver surface compatible with GenericSolverDebugger + meshNodes output */
type BaseSolverLike = {
  solve: () => void
  visualize: () => any
  getOutput: () => { meshNodes: CapacityMeshNode[] }
}

type SolverDebugger3dProps = {
  solver: BaseSolverLike
  /** Optional SRJ to show board bounds & rectangular obstacles */
  simpleRouteJson?: SimpleRouteJson
  /** Visual Z thickness per layer (world units) */
  layerThickness?: number
  /** Canvas height */
  height?: number
  /** Initial toggles (user can change in UI) */
  defaultShowRoot?: boolean
  defaultShowObstacles?: boolean
  defaultShowOutput?: boolean
  defaultWireframeOutput?: boolean
  /** Wrap styles */
  style?: React.CSSProperties
}

/* ----------------------------- helpers ----------------------------- */

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

/** Canonical layer order to mirror the solver & experiment */
function layerSortKey(name: string) {
  const n = name.toLowerCase()
  if (n === "top") return -1_000_000
  if (n === "bottom") return 1_000_000
  const m = /^inner(\d+)$/i.exec(n)
  if (m) return parseInt(m[1]!, 10) || 0
  return 100 + n.charCodeAt(0)
}
function canonicalizeLayerOrder(names: string[]) {
  return [...new Set(names)].sort((a, b) => {
    const ka = layerSortKey(a)
    const kb = layerSortKey(b)
    if (ka !== kb) return ka - kb
    return a.localeCompare(b)
  })
}

/** Build prisms by grouping identical XY nodes across contiguous Z */
function buildPrismsFromNodes(
  nodes: CapacityMeshNode[],
  fallbackLayerCount: number,
): Array<{
  minX: number
  maxX: number
  minY: number
  maxY: number
  z0: number
  z1: number
}> {
  const xyKey = (n: CapacityMeshNode) =>
    `${n.center.x.toFixed(8)}|${n.center.y.toFixed(8)}|${n.width.toFixed(8)}|${n.height.toFixed(8)}`
  const azKey = (n: CapacityMeshNode) => {
    const zs = (
      n.availableZ && n.availableZ.length ? [...new Set(n.availableZ)] : [0]
    ).sort((a, b) => a - b)
    return `zset:${zs.join(",")}`
  }
  const key = (n: CapacityMeshNode) => `${xyKey(n)}|${azKey(n)}`

  const groups = new Map<
    string,
    { cx: number; cy: number; w: number; h: number; zs: number[] }
  >()
  for (const n of nodes) {
    const k = key(n)
    const zlist = n.availableZ?.length ? n.availableZ : [0]
    const g = groups.get(k)
    if (g) g.zs.push(...zlist)
    else
      groups.set(k, {
        cx: n.center.x,
        cy: n.center.y,
        w: n.width,
        h: n.height,
        zs: [...zlist],
      })
  }

  const prisms: Array<{
    minX: number
    maxX: number
    minY: number
    maxY: number
    z0: number
    z1: number
  }> = []
  for (const g of groups.values()) {
    const minX = g.cx - g.w / 2
    const maxX = g.cx + g.w / 2
    const minY = g.cy - g.h / 2
    const maxY = g.cy + g.h / 2
    const runs = contiguousRuns(g.zs)
    if (runs.length === 0) {
      prisms.push({
        minX,
        maxX,
        minY,
        maxY,
        z0: 0,
        z1: Math.max(1, fallbackLayerCount),
      })
    } else {
      for (const r of runs) {
        prisms.push({
          minX,
          maxX,
          minY,
          maxY,
          z0: r[0],
          z1: r[r.length - 1] + 1,
        })
      }
    }
  }
  return prisms
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function darkenColor(hex: number, factor = 0.6): number {
  const r = ((hex >> 16) & 0xff) * factor
  const g = ((hex >> 8) & 0xff) * factor
  const b = (hex & 0xff) * factor
  const cr = Math.max(0, Math.min(255, Math.round(r)))
  const cg = Math.max(0, Math.min(255, Math.round(g)))
  const cb = Math.max(0, Math.min(255, Math.round(b)))
  return (cr << 16) | (cg << 8) | cb
}

/* ---------------------------- 3D Canvas ---------------------------- */

const ThreeBoardView: React.FC<{
  nodes: CapacityMeshNode[]
  srj?: SimpleRouteJson
  layerThickness: number
  height: number
  showRoot: boolean
  showObstacles: boolean
  showOutput: boolean
  wireframeOutput: boolean
  meshOpacity: number
  shrinkBoxes: boolean
  boxShrinkAmount: number
  showBorders: boolean
}> = ({
  nodes,
  srj,
  layerThickness,
  height,
  showRoot,
  showObstacles,
  showOutput,
  wireframeOutput,
  meshOpacity,
  shrinkBoxes,
  boxShrinkAmount,
  showBorders,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const destroyRef = useRef<() => void>(() => {})

  const layerNames = useMemo(() => {
    // Build from nodes (preferred, matches solver) and fall back to SRJ obstacle names
    const fromNodes = canonicalizeLayerOrder(nodes.map((n) => n.layer))
    if (fromNodes.length) return fromNodes
    const fromObs = canonicalizeLayerOrder(
      (srj?.obstacles ?? []).flatMap((o) => o.layers ?? []),
    )
    return fromObs.length ? fromObs : ["top"]
  }, [nodes, srj])

  const zIndexByLayerName = useMemo(() => {
    const m = new Map<string, number>()
    layerNames.forEach((n, i) => m.set(n, i))
    return m
  }, [layerNames])

  const layerCount = layerNames.length || srj?.layerCount || 1

  const prisms = useMemo(
    () => buildPrismsFromNodes(nodes, layerCount),
    [nodes, layerCount],
  )

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const el = containerRef.current
      if (!el) return
      if (!mounted) return

      destroyRef.current?.()

      const w = el.clientWidth || 800
      const h = el.clientHeight || height

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h)
      el.innerHTML = ""
      el.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf7f8fa)

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000)
      camera.position.set(80, 80, 120)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true

      const amb = new THREE.AmbientLight(0xffffff, 0.9)
      scene.add(amb)
      const dir = new THREE.DirectionalLight(0xffffff, 0.6)
      dir.position.set(1, 2, 3)
      scene.add(dir)

      const rootGroup = new THREE.Group()
      const obstaclesGroup = new THREE.Group()
      const outputGroup = new THREE.Group()
      scene.add(rootGroup, obstaclesGroup, outputGroup)

      // Axes helper for orientation (similar to experiment)
      const axes = new THREE.AxesHelper(50)
      scene.add(axes)

      const colorRoot = 0x111827
      const colorOb = 0xef4444

      // Palette for layer-span-based coloring
      const spanPalette = [
        0x0ea5e9, // cyan-ish
        0x22c55e, // green
        0xf97316, // orange
        0xa855f7, // purple
        0xfacc15, // yellow
        0x38bdf8, // light blue
        0xec4899, // pink
        0x14b8a6, // teal
      ]
      const spanColorMap = new Map<string, number>()
      let spanColorIndex = 0
      const getSpanColor = (z0: number, z1: number) => {
        const key = `${z0}-${z1}`
        let c = spanColorMap.get(key)
        if (c == null) {
          c = spanPalette[spanColorIndex % spanPalette.length]
          spanColorMap.set(key, c)
          spanColorIndex++
        }
        return c
      }

      function makeBoxMesh(
        b: {
          minX: number
          maxX: number
          minY: number
          maxY: number
          z0: number
          z1: number
        },
        color: number,
        wire: boolean,
        opacity = 0.45,
        borders = false,
      ) {
        const dx = b.maxX - b.minX
        const dz = b.maxY - b.minY // map board Y -> three Z
        const dy = (b.z1 - b.z0) * layerThickness
        const cx = (b.minX + b.maxX) / 2
        const cz = (b.minY + b.maxY) / 2
        // Negate Y so z=0 is at top, higher z goes down
        const cy = -((b.z0 + b.z1) / 2) * layerThickness

        const geom = new THREE.BoxGeometry(dx, dy, dz)
        if (wire) {
          const edges = new THREE.EdgesGeometry(geom)
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color }),
          )
          line.position.set(cx, cy, cz)
          return line
        }
        const clampedOpacity = clamp01(opacity)
        const mat = new THREE.MeshPhongMaterial({
          color,
          opacity: clampedOpacity,
          transparent: clampedOpacity < 1,
          alphaHash: clampedOpacity < 1,
        })

        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(cx, cy, cz)

        if (!borders) return mesh

        const edges = new THREE.EdgesGeometry(geom)
        const borderColor = darkenColor(color, 0.6)
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: borderColor }),
        )
        line.position.set(cx, cy, cz)

        const group = new THREE.Group()
        group.add(mesh)
        group.add(line)
        return group
      }

      // Root wireframe from SRJ bounds
      if (srj && showRoot) {
        const rootBox = {
          minX: srj.bounds.minX,
          maxX: srj.bounds.maxX,
          minY: srj.bounds.minY,
          maxY: srj.bounds.maxY,
          z0: 0,
          z1: layerCount,
        }
        rootGroup.add(makeBoxMesh(rootBox, colorRoot, true, 1))
      }

      // Obstacles — rectangular only — one slab per declared layer
      if (srj && showObstacles) {
        for (const ob of srj.obstacles ?? []) {
          if (ob.type !== "rect") continue
          const minX = ob.center.x - ob.width / 2
          const maxX = ob.center.x + ob.width / 2
          const minY = ob.center.y - ob.height / 2
          const maxY = ob.center.y + ob.height / 2

          // Prefer explicit zLayers; otherwise map layer names to indices
          const zs =
            ob.zLayers && ob.zLayers.length
              ? [...new Set(ob.zLayers)]
              : (ob.layers ?? [])
                  .map((name) => zIndexByLayerName.get(name))
                  .filter((z): z is number => typeof z === "number")

          for (const z of zs) {
            if (z < 0 || z >= layerCount) continue
            obstaclesGroup.add(
              makeBoxMesh(
                { minX, maxX, minY, maxY, z0: z, z1: z + 1 },
                colorOb,
                false,
                0.35,
                false,
              ),
            )
          }
        }
      }

      // Output prisms from nodes (wireframe toggle like the experiment)
      if (showOutput) {
        for (const p of prisms) {
          let box = p
          if (shrinkBoxes && boxShrinkAmount > 0) {
            const s = boxShrinkAmount

            const widthX = p.maxX - p.minX
            const widthY = p.maxY - p.minY

            // Never shrink more on a side than allowed by the configured shrink amount
            // while ensuring we don't shrink past a minimum dimension of "s"
            const maxShrinkEachSideX = Math.max(0, (widthX - s) / 2)
            const maxShrinkEachSideY = Math.max(0, (widthY - s) / 2)

            const shrinkX = Math.min(s, maxShrinkEachSideX)
            const shrinkY = Math.min(s, maxShrinkEachSideY)

            const minX = p.minX + shrinkX
            const maxX = p.maxX - shrinkX
            const minY = p.minY + shrinkY
            const maxY = p.maxY - shrinkY

            // Guard against any degenerate box
            if (minX >= maxX || minY >= maxY) {
              continue
            }

            box = { ...p, minX, maxX, minY, maxY }
          }

          const color = getSpanColor(p.z0, p.z1)
          outputGroup.add(
            makeBoxMesh(
              box,
              color,
              wireframeOutput,
              meshOpacity,
              showBorders && !wireframeOutput,
            ),
          )
        }
      }

      // Fit camera
      const fitBox = srj
        ? {
            minX: srj.bounds.minX,
            maxX: srj.bounds.maxX,
            minY: srj.bounds.minY,
            maxY: srj.bounds.maxY,
            z0: 0,
            z1: layerCount,
          }
        : (() => {
            if (prisms.length === 0) {
              return {
                minX: -10,
                maxX: 10,
                minY: -10,
                maxY: 10,
                z0: 0,
                z1: layerCount,
              }
            }
            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity
            for (const p of prisms) {
              minX = Math.min(minX, p.minX)
              maxX = Math.max(maxX, p.maxX)
              minY = Math.min(minY, p.minY)
              maxY = Math.max(maxY, p.maxY)
            }
            return { minX, maxX, minY, maxY, z0: 0, z1: layerCount }
          })()

      const dx = fitBox.maxX - fitBox.minX
      const dz = fitBox.maxY - fitBox.minY
      const dy = (fitBox.z1 - fitBox.z0) * layerThickness
      const size = Math.max(dx, dz, dy)
      const dist = size * 2.0
      // Camera looks from above-right-front, with negative Y being "up" (z=0 at top)
      camera.position.set(
        fitBox.maxX + dist * 0.6,
        -dy / 2 + dist, // negative Y is up, so position above the center
        fitBox.maxY + dist * 0.6,
      )
      camera.near = Math.max(0.1, size / 100)
      camera.far = dist * 10 + size * 10
      camera.updateProjectionMatrix()
      controls.target.set(
        (fitBox.minX + fitBox.maxX) / 2,
        -dy / 2, // center of the inverted Y range
        (fitBox.minY + fitBox.maxY) / 2,
      )
      controls.update()

      const onResize = () => {
        const W = el.clientWidth || w
        const H = el.clientHeight || h
        camera.aspect = W / H
        camera.updateProjectionMatrix()
        renderer.setSize(W, H)
      }
      window.addEventListener("resize", onResize)

      let raf = 0
      const animate = () => {
        raf = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      destroyRef.current = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener("resize", onResize)
        renderer.dispose()
        el.innerHTML = ""
      }
    })()

    return () => {
      mounted = false
      destroyRef.current?.()
    }
  }, [
    srj,
    prisms,
    layerCount,
    layerThickness,
    height,
    showRoot,
    showObstacles,
    showOutput,
    wireframeOutput,
    zIndexByLayerName,
    meshOpacity,
    shrinkBoxes,
    boxShrinkAmount,
    showBorders,
  ])

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
        background: "#f7f8fa",
      }}
    />
  )
}

/* ----------------------- Public wrapper component ----------------------- */

export const SolverDebugger3d: React.FC<SolverDebugger3dProps> = ({
  solver,
  simpleRouteJson,
  layerThickness = 1,
  height = 460,
  defaultShowRoot = true,
  defaultShowObstacles = false, // don't show obstacles by default
  defaultShowOutput = true,
  defaultWireframeOutput = false,
  style,
}) => {
  const [show3d, setShow3d] = useState(false)
  const [rebuildKey, setRebuildKey] = useState(0)

  const [showRoot, setShowRoot] = useState(defaultShowRoot)
  const [showObstacles, setShowObstacles] = useState(defaultShowObstacles)
  const [showOutput, setShowOutput] = useState(defaultShowOutput)
  const [wireframeOutput, setWireframeOutput] = useState(defaultWireframeOutput)

  const [meshOpacity, setMeshOpacity] = useState(1) // fully opaque by default
  const [shrinkBoxes, setShrinkBoxes] = useState(false)
  const [boxShrinkAmount, setBoxShrinkAmount] = useState(0.1)
  const [showBorders, setShowBorders] = useState(false)

  // Mesh nodes state - updated when solver completes or during stepping
  const [meshNodes, setMeshNodes] = useState<CapacityMeshNode[]>([])

  // Update mesh nodes from solver output
  const updateMeshNodes = useCallback(() => {
    try {
      const output = solver.getOutput()
      const nodes = output.meshNodes ?? []
      setMeshNodes(nodes)
    } catch {
      setMeshNodes([])
    }
  }, [solver])

  // Initialize mesh nodes on mount (in case solver is already solved)
  useEffect(() => {
    updateMeshNodes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle solver completion
  const handleSolverCompleted = useCallback(() => {
    updateMeshNodes()
  }, [updateMeshNodes])

  // Poll for updates during stepping (GenericSolverDebugger doesn't have onStep)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only update if solver has output available
      if ((solver as any).solved || (solver as any).stats?.placed > 0) {
        updateMeshNodes()
      }
    }, 100) // Poll every 100ms during active solving

    return () => clearInterval(interval)
  }, [updateMeshNodes, solver])

  const toggle3d = useCallback(() => setShow3d((s) => !s), [])
  const rebuild = useCallback(() => setRebuildKey((k) => k + 1), [])

  return (
    <>
      <div style={{ display: "grid", gap: 12, ...style }}>
        <GenericSolverDebugger
          solver={solver as any}
          onSolverCompleted={handleSolverCompleted}
        />

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={toggle3d}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: show3d ? "#1e293b" : "#2563eb",
              color: "white",
              cursor: "pointer",
            }}
          >
            {show3d ? "Hide 3D" : "Show 3D"}
          </button>
          {show3d && (
            <button
              onClick={rebuild}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                background: "#0f766e",
                color: "white",
                cursor: "pointer",
              }}
              title="Rebuild 3D scene (use after changing solver params)"
            >
              Rebuild 3D
            </button>
          )}

          {/* experiment-like toggles */}
          <label
            style={{
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
              marginLeft: 8,
            }}
          >
            <input
              type="checkbox"
              checked={showRoot}
              onChange={(e) => setShowRoot(e.target.checked)}
            />
            Root
          </label>
          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={showObstacles}
              onChange={(e) => setShowObstacles(e.target.checked)}
            />
            Obstacles
          </label>
          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={showOutput}
              onChange={(e) => setShowOutput(e.target.checked)}
            />
            Output
          </label>
          <label
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={wireframeOutput}
              onChange={(e) => setWireframeOutput(e.target.checked)}
            />
            Wireframe Output
          </label>

          {/* Mesh opacity slider */}
          {show3d && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginLeft: 8,
                fontSize: 12,
              }}
            >
              Opacity
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={meshOpacity}
                onChange={(e) => setMeshOpacity(parseFloat(e.target.value))}
              />
              <span style={{ width: 32, textAlign: "right" }}>
                {meshOpacity.toFixed(2)}
              </span>
            </label>
          )}

          {/* Shrink boxes option */}
          {show3d && (
            <>
              <label
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={shrinkBoxes}
                  onChange={(e) => setShrinkBoxes(e.target.checked)}
                />
                Shrink boxes
              </label>
              {shrinkBoxes && (
                <label
                  style={{
                    display: "inline-flex",
                    gap: 4,
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  amt
                  <input
                    type="number"
                    value={boxShrinkAmount}
                    step={0.05}
                    style={{ width: 60 }}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (Number.isNaN(v)) return
                      setBoxShrinkAmount(Math.max(0, v))
                    }}
                  />
                </label>
              )}
            </>
          )}

          {/* Show borders option */}
          {show3d && (
            <label
              style={{
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={showBorders}
                disabled={wireframeOutput}
                onChange={(e) => setShowBorders(e.target.checked)}
              />
              <span
                style={{
                  opacity: wireframeOutput ? 0.5 : 1,
                }}
              >
                Show borders
              </span>
            </label>
          )}

          <div style={{ fontSize: 12, color: "#334155", marginLeft: 6 }}>
            Drag to orbit · Wheel to zoom · Right-drag to pan
          </div>
        </div>

        {show3d && (
          <ThreeBoardView
            key={rebuildKey}
            nodes={meshNodes}
            srj={simpleRouteJson}
            layerThickness={layerThickness}
            height={height}
            showRoot={showRoot}
            showObstacles={showObstacles}
            showOutput={showOutput}
            wireframeOutput={wireframeOutput}
            meshOpacity={meshOpacity}
            shrinkBoxes={shrinkBoxes}
            boxShrinkAmount={boxShrinkAmount}
            showBorders={showBorders}
          />
        )}
      </div>

      {/* White margin at bottom of the page */}
      <div style={{ height: 200, background: "#ffffff" }} />
    </>
  )
}
