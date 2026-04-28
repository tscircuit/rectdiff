import { EPS } from "../../utils/rectdiff-geometry"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"

/**
 * Measure the usable multilayer volume share of the current mesh.
 * Obstacle volume is removed from the denominator to match existing rectdiff semantics.
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
