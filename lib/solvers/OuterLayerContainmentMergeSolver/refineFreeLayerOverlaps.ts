import { boundsIntersection } from "@tscircuit/math-utils"
import type { CapacityMeshNode } from "../../types/capacity-mesh-types"
import type { SimpleRouteJson } from "../../types/srj-types"
import type { XYRect } from "../../rectdiff-types"
import { obstacleToXYRect, obstacleZs } from "../RectDiffSeedingSolver/layers"
import { EPS, overlaps, subtractRect2D } from "../../utils/rectdiff-geometry"
import { padRect } from "../../utils/padRect"

const nodeRect = (node: CapacityMeshNode): XYRect => ({
  x: node.center.x - node.width / 2,
  y: node.center.y - node.height / 2,
  width: node.width,
  height: node.height,
})

const rectBounds = (rect: XYRect) => ({
  minX: rect.x,
  minY: rect.y,
  maxX: rect.x + rect.width,
  maxY: rect.y + rect.height,
})

function createRefinedNode(
  { source, rect }: { source: CapacityMeshNode; rect: XYRect },
  ids: { used: Set<string>; next: number },
): CapacityMeshNode {
  let capacityMeshNodeId = `free_overlap_${ids.next++}`
  while (ids.used.has(capacityMeshNodeId)) {
    capacityMeshNodeId = `free_overlap_${ids.next++}`
  }
  ids.used.add(capacityMeshNodeId)
  return {
    ...source,
    capacityMeshNodeId,
    center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    width: rect.width,
    height: rect.height,
  }
}

/** Refine free meshes across copper-pour layers while retaining each remainder. */
export function refineFreeLayerOverlaps({
  meshNodes,
  simpleRouteJson,
  zIndexByName,
  obstacleClearance = 0,
}: {
  meshNodes: CapacityMeshNode[]
  simpleRouteJson: SimpleRouteJson
  zIndexByName: Map<string, number>
  obstacleClearance?: number
}): CapacityMeshNode[] {
  const freeNodes = meshNodes.filter(
    (node) =>
      !node._containsObstacle && !node._containsTarget && !node._strawNode,
  )
  const singleLayerNodes = freeNodes.filter(
    (node) => node.availableZ.length === 1,
  )
  const multilayerNodes = freeNodes.filter((node) => node.availableZ.length > 1)
  if (singleLayerNodes.length === 0 || multilayerNodes.length === 0) {
    return meshNodes
  }
  const obstacles = simpleRouteJson.obstacles.flatMap((obstacle) => {
    const rect = obstacleToXYRect(obstacle)
    if (!rect) return []
    return [
      {
        obstacle,
        rect: padRect(rect, obstacleClearance),
        layers: obstacleZs(obstacle, zIndexByName),
      },
    ]
  })
  const pieces = new Map(meshNodes.map((node) => [node, [nodeRect(node)]]))
  const sharedNodes: CapacityMeshNode[] = []
  const minViaSize = Math.max(
    simpleRouteJson.minViaDiameter ?? 0,
    simpleRouteJson.minTraceWidth,
  )
  const ids = {
    used: new Set(meshNodes.map((node) => node.capacityMeshNodeId)),
    next: 0,
  }

  for (const single of singleLayerNodes) {
    for (const multi of multilayerNodes) {
      if (multi.availableZ.includes(single.availableZ[0]!)) continue
      const availableZ = [...single.availableZ, ...multi.availableZ].sort(
        (a, b) => a - b,
      )
      const skippedLayers: number[] = []
      for (let z = availableZ[0]!; z <= availableZ.at(-1)!; z++) {
        if (!availableZ.includes(z)) skippedLayers.push(z)
      }
      if (skippedLayers.length === 0) continue
      const singlePieces = pieces.get(single)!
      const multiPieces = pieces.get(multi)!
      for (let a = 0; a < singlePieces.length; a++) {
        for (let b = 0; b < multiPieces.length; b++) {
          const singleRect = singlePieces[a]!
          const multiRect = multiPieces[b]!
          const overlap = boundsIntersection(
            rectBounds(singleRect),
            rectBounds(multiRect),
          )
          if (!overlap) continue
          const rect = {
            x: overlap.minX,
            y: overlap.minY,
            width: overlap.maxX - overlap.minX,
            height: overlap.maxY - overlap.minY,
          }
          if (rect.width + EPS < minViaSize || rect.height + EPS < minViaSize)
            continue
          const crossingObstacles = obstacles.filter(
            (entry) =>
              entry.layers.some(
                (z) => z >= availableZ[0]! && z <= availableZ.at(-1)!,
              ) && overlaps(entry.rect, rect),
          )
          if (crossingObstacles.some((entry) => !entry.obstacle.isCopperPour))
            continue
          const coveredByPour = skippedLayers.every((z) => {
            let uncovered = [rect]
            for (const entry of crossingObstacles) {
              if (entry.layers.includes(z))
                uncovered = uncovered.flatMap((piece) =>
                  subtractRect2D(piece, entry.rect),
                )
            }
            return uncovered.length === 0
          })
          if (!coveredByPour) continue
          sharedNodes.push({
            ...createRefinedNode({ source: single, rect }, ids),
            availableZ,
            layer: `z${availableZ.join(",")}`,
          })
          singlePieces.splice(a, 1, ...subtractRect2D(singleRect, rect))
          multiPieces.splice(b, 1, ...subtractRect2D(multiRect, rect))
          a--
          break
        }
      }
    }
  }
  if (sharedNodes.length === 0) return meshNodes
  return meshNodes
    .flatMap((node) => {
      const remaining = pieces.get(node)!
      if (remaining.length === 1) {
        const original = nodeRect(node)
        if (
          remaining[0]!.x === original.x &&
          remaining[0]!.y === original.y &&
          remaining[0]!.width === original.width &&
          remaining[0]!.height === original.height
        )
          return [node]
      }
      return remaining.map((rect) =>
        createRefinedNode({ source: node, rect }, ids),
      )
    })
    .concat(sharedNodes)
}
