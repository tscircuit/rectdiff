import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

type GapFillFootprintKey = string
type GapFillFootprintEntry = {
  node: CapacityMeshNode
  key: GapFillFootprintKey
}

export function mergeCoincidentGapFillNodes({
  nodes,
  layerCount,
}: {
  nodes: CapacityMeshNode[]
  layerCount: number
}): CapacityMeshNode[] {
  const entries = nodes.map(
    (node): GapFillFootprintEntry => ({
      node,
      key: JSON.stringify([
        node.center.x,
        node.center.y,
        node.width,
        node.height,
      ]),
    }),
  )
  const nodesByFootprint = new Map<GapFillFootprintKey, CapacityMeshNode[]>()
  for (const { node, key } of entries) {
    const group = nodesByFootprint.get(key)
    if (group) group.push(node)
    else nodesByFootprint.set(key, [node])
  }

  return entries.flatMap(({ node, key }): CapacityMeshNode[] => {
    const group = nodesByFootprint.get(key)!
    const availableZ = [
      ...new Set(group.flatMap((source): number[] => source.availableZ)),
    ].sort((a, b): number => a - b)
    const coversAllLayers =
      availableZ.length === layerCount &&
      availableZ.every((z, index): boolean => z === index)
    const containsCopper = group.some((source): boolean =>
      Boolean(
        source._containsObstacle ||
          source._containsTarget ||
          source._targetConnectionName ||
          source._connectedTo?.length,
      ),
    )
    if (!coversAllLayers || containsCopper || group.length === 1) return [node]
    if (node !== group[0]) return []
    return [{ ...node, availableZ, layer: `z${availableZ.join(",")}` }]
  })
}
