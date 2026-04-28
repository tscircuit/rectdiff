import { EPS } from "../../utils/rectdiff-geometry"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Measure how much usable space is shared across multiple layers.
 * Obstacle-only space is not counted.
 */
export const getUsableMultilayerVolumeShare = ({
  nodes,
}: {
  nodes: CapacityMeshNode[]
}) => {
  let totalVolume = 0
  let obstacleVolume = 0
  let multilayerVolume = 0

  for (const node of nodes) {
    const volume = node.width * node.height * node.availableZ.length
    totalVolume += volume

    if (node._containsObstacle) {
      obstacleVolume += volume
      continue
    }

    if (node.availableZ.length > 1) {
      multilayerVolume += volume
    }
  }

  const usableVolume = totalVolume - obstacleVolume
  if (usableVolume <= EPS) return 0
  return multilayerVolume / usableVolume
}
