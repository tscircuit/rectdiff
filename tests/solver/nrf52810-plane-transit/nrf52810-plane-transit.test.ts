import { beforeAll, expect, test } from "bun:test"
import type { AnyCircuitElement, LayerRef } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  RectDiffPipeline,
  type RectDiffPipelineInput,
} from "lib/RectDiffPipeline"
import type { CapacityMeshNode } from "lib/types/capacity-mesh-types"
import { stackSvgsHorizontally, stackSvgsVertically } from "stack-svgs"
import routingInput from "./nrf52810-plane-transit.json"
import boardJson from "./nrf52810-swd-board.json"

// Captured from core d503a837, capacity-autorouter 0.0.1080. This is a
// four-layer adaptation of the real nRF52810 tracker SWD interface, preserving
// its NRF52810_QFAA_R and BM05B-SRSS-TB footprints and SWD pin assignments:
// https://github.com/tscircuit/core/tree/d503a837/tests/repros/repro-nrf52810-without-copper-pours
// Outer-layer channel keepouts force the two SWD nets onto an inner signal
// layer. Inner1 is an unbroken GND pour; through-vias may cross it.
const solver = new RectDiffPipeline(routingInput as RectDiffPipelineInput)
let meshNodes: CapacityMeshNode[]
let meshBeforeTransit: CapacityMeshNode[]

const isFree = (node: CapacityMeshNode) =>
  !node._containsObstacle && !node._containsTarget

const hasTopToInner2Transit = (node: CapacityMeshNode) =>
  isFree(node) && node.availableZ.includes(0) && node.availableZ.includes(2)

/**
 * Render the captured physical PCB with the actual solver regions overlaid.
 * Circuit JSON and mesh centers are board-world points in mm, right-handed:
 * +X right, +Y up, +Z toward top copper. Green outlines are routing access
 * regions, not fabricated copper or hand-authored expected routes.
 */
const createBoardMeshSnapshot = () => {
  const sharedCount = meshNodes.filter(hasTopToInner2Transit).length
  const layerNames: LayerRef[] = ["top", "inner1", "inner2", "bottom"]
  const panels = layerNames.map((layer, z) => {
    const notes: AnyCircuitElement[] =
      layer !== "top" && layer !== "bottom"
        ? []
        : meshNodes
            .filter((node) => isFree(node) && node.availableZ.includes(z))
            .map((node, nodeIndex) => ({
              type: "pcb_note_rect",
              pcb_note_rect_id: `routing_region_${z}_${nodeIndex}`,
              layer: layer === "top" ? "top" : "bottom",
              center: node.center,
              width: node.width,
              height: node.height,
              stroke_width: hasTopToInner2Transit(node) ? 0.08 : 0.025,
              is_filled: false,
              color: hasTopToInner2Transit(node) ? "#4ade80" : "#64748b",
            }))
    const caption = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="120" viewBox="0 0 800 120">
      <rect width="800" height="120" fill="#121212"/>
      <text x="400" y="30" fill="white" font-family="Arial, sans-serif" font-size="23" text-anchor="middle">nRF52810 SWD interface — ${layer}</text>
      <text x="400" y="61" fill="#4ade80" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">Shared Top / Inner2 routing regions: ${sharedCount}</text>
      <text x="400" y="88" fill="white" font-family="Arial, sans-serif" font-size="17" text-anchor="middle">Inner1: ground | Inner2: signal | Through-vias cross the plane</text>
      <text x="400" y="110" fill="#94a3b8" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">Outer views: green = shared access; gray = separate regions</text>
    </svg>`
    return stackSvgsVertically(
      [
        caption,
        convertCircuitJsonToPcbSvg(
          [...(boardJson as AnyCircuitElement[]), ...notes],
          { layer, shouldDrawErrors: false },
        ),
      ],
      { gap: 0, normalizeSize: false },
    )
  })
  return stackSvgsVertically(
    [
      stackSvgsHorizontally(panels.slice(0, 2), {
        gap: 16,
        normalizeSize: false,
      }),
      stackSvgsHorizontally(panels.slice(2), { gap: 16, normalizeSize: false }),
    ],
    { gap: 16, normalizeSize: false },
  )
}

beforeAll(async () => {
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  meshNodes = solver.getOutput().meshNodes
  meshBeforeTransit = structuredClone(
    solver.gapFillSolver!.getOutput().outputNodes,
  )
  // A snapshot mismatch must fail independently of the expected behavior bug.
  await expect(createBoardMeshSnapshot()).toMatchSvgSnapshot(import.meta.path)
})

test("nRF52810 SWD reaches Inner2 across the ground plane", () => {
  expect(meshNodes.filter(hasTopToInner2Transit).length).toBeGreaterThan(0)
  expect(
    meshNodes.filter(isFree).some((node) => node.availableZ.includes(1)),
  ).toBe(false)

  // Reconnecting layers must preserve the actual free area on every layer.
  for (const z of [0, 1, 2, 3]) {
    const areaOnLayer = (nodes: CapacityMeshNode[]) =>
      nodes
        .filter((node) => isFree(node) && node.availableZ.includes(z))
        .reduce((area, node) => area + node.width * node.height, 0)
    expect(areaOnLayer(meshNodes)).toBeCloseTo(
      areaOnLayer(meshBeforeTransit),
      8,
    )
  }
  expect(new Set(meshNodes.map((node) => node.capacityMeshNodeId)).size).toBe(
    meshNodes.length,
  )
})
