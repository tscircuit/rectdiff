import type { Rect3d } from "../../rectdiff-types"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

const cloneConnectedToByZ = (
  connectedToByZ: Record<number, string[]> | undefined,
): Record<number, string[]> | undefined => {
  if (!connectedToByZ) return undefined

  const clone: Record<number, string[]> = {}
  for (const [z, connectionNames] of Object.entries(connectedToByZ)) {
    clone[Number(z)] = [...connectionNames]
  }
  return clone
}

export function rectsToMeshNodes(rects: Rect3d[]): CapacityMeshNode[] {
  let id = 0
  const out: CapacityMeshNode[] = []
  for (const r of rects) {
    const w = Math.max(0, r.maxX - r.minX)
    const h = Math.max(0, r.maxY - r.minY)
    if (w <= 0 || h <= 0 || r.zLayers.length === 0) continue

    const connectedToByZ = cloneConnectedToByZ(r.connectedToByZ)
    out.push({
      capacityMeshNodeId: `cmn_${id++}`,
      center: { x: (r.minX + r.maxX) / 2, y: (r.minY + r.maxY) / 2 },
      width: w,
      height: h,
      layer: "top",
      availableZ: r.zLayers.slice(),
      _containsObstacle: r.isObstacle,
      _containsTarget: r.isObstacle,
      ...(r.connectedTo?.length ? { _connectedTo: [...r.connectedTo] } : {}),
      ...(connectedToByZ ? { _connectedToByZ: connectedToByZ } : {}),
    })
  }

  return out
}
