import type { CapacityMeshNode } from "../../lib/types/capacity-mesh-types"
import srj from "../../test-assets/simplified-out-of-bounds-example.json"

/** Fixed viewport makes before/after board-edge geometry directly comparable. */
export function makeBoardBoundsSnapshot(nodes: CapacityMeshNode[]): string {
  const x = (value: number) => 350 + value * 27
  const y = (value: number) => 240 - value * 27
  const rect = (
    cx: number,
    cy: number,
    width: number,
    height: number,
    color: string,
  ) =>
    `<rect x="${x(cx - width / 2)}" y="${y(cy + height / 2)}" width="${width * 27}" height="${height * 27}" fill="${color}" stroke="${color}" fill-opacity="0.18"/>`
  const generated = nodes.filter((node) =>
    node.capacityMeshNodeId.startsWith("new-"),
  )
  const outside = generated.filter(
    (node) => node.center.y - node.height / 2 < srj.bounds.minY - 1e-8,
  )
  const lowerEdge = Math.min(
    ...generated.map((node) => node.center.y - node.height / 2),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="570" viewBox="0 0 700 570">
<rect width="700" height="570" fill="white"/>
<g font-family="sans-serif" fill="#18212b">
<text x="24" y="30" font-size="20">Gap fill must stay inside the board</text>
<text x="24" y="54" font-size="14">Top layer · blue: board · green: generated mesh · red: outside</text>
${nodes
  .filter((n) => n.availableZ.includes(0))
  .map((n) =>
    rect(
      n.center.x,
      n.center.y,
      n.width,
      n.height,
      n.capacityMeshNodeId.startsWith("new-")
        ? outside.includes(n)
          ? "#dc2626"
          : "#16803c"
        : "#64748b",
    ),
  )
  .join("\n")}
${srj.obstacles.map((o: { center: { x: number; y: number }; width: number; height: number }) => rect(o.center.x, o.center.y, o.width, o.height, "#9333ea")).join("\n")}
<rect x="${x(-5.5)}" y="${y(6)}" width="297" height="324" fill="none" stroke="#2563eb" stroke-width="3"/>
<text x="510" y="402" font-size="14" fill="#2563eb">minY = -6.000</text>
<text x="24" y="522" font-size="16">${outside.length ? "BUG: generated mesh crosses the lower board edge" : "FIXED: generated mesh stays inside the board"}</text>
<text x="24" y="548" font-size="14">Generated lower edge: ${generated.length ? `${lowerEdge.toFixed(3)} mm` : "none needed (grid fills board)"} · purple: external obstacle</text>
</g></svg>`
}
