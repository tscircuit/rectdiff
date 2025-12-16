// lib/solvers/rectdiff/edge-expansion-gapfill/stepExpansion.ts
import type { EdgeExpansionGapFillState, Direction, GapFillNode } from "./types"
import type { XYRect, Placed3D } from "../types"
import { createNodesFromObstacle } from "./createNodesFromObstacle"
import { validateInitialNodes } from "./validateInitialNodes"
import { filterOverlappingNodes } from "./filterOverlappingNodes"
import { calculateAvailableSpace } from "./calculateAvailableSpace"
import { calculatePotentialArea } from "./calculatePotentialArea"
import { calculateMaxExpansion } from "./calculateMaxExpansion"
import { expandNode } from "./expandNode"
import { mergeAdjacentLayerNodes } from "./mergeAdjacentLayerNodes"
import { validateNoOverlaps } from "./validateNoOverlaps"
import { overlaps } from "../geometry"

const ALL_DIRECTIONS: Direction[] = ["up", "down", "left", "right"]

/**
 * Get the opposite direction (the direction pointing toward the parent obstacle)
 */
function getOppositeDirection(direction: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  }
  return opposites[direction]
}

/**
 * Execute one micro-step of the edge expansion gap-fill algorithm.
 *
 * **What it does:**
 * This is the core incremental step function that processes obstacles one at a time,
 * creating seed nodes around each obstacle and expanding them to fill available space.
 * Each call performs exactly one small operation (e.g., creating initial nodes for an
 * obstacle, or expanding one node in one direction by a small amount).
 *
 * **Algorithm phases:**
 * 1. **Node Creation**: When starting a new obstacle, creates 4 tiny seed rectangles
 *    (one at each edge: top, bottom, left, right) around the obstacle. Filters out
 *    nodes that would immediately overlap with existing capacity nodes or obstacles.
 *
 * 2. **Expansion Planning**: For each active node, evaluates all possible expansion
 *    directions (except the one pointing toward the parent obstacle). Calculates
 *    available space, respects aspect ratio constraints, and selects the best
 *    expansion candidate based on potential area gained.
 *
 * 3. **Node Expansion**: Expands one node in one direction by the calculated amount.
 *    If aspect ratio limits are hit but space remains, spawns child nodes to fill
 *    the remaining gap. This allows recursive gap filling.
 *
 * 4. **Completion**: When a node can no longer expand, merges it with adjacent-layer
 *    nodes that have identical dimensions. When all nodes for an obstacle are done,
 *    finalizes them and moves to the next obstacle.
 *
 * **Granularity:**
 * Designed for visualization - each call performs minimal work so the solver can be
 * stepped incrementally for real-time visualization. Typical execution:
 * - One obstacle processed per many steps (one step per node expansion)
 * - One node expanded per step (one direction, one amount)
 * - Child nodes spawned immediately when aspect ratio limits hit
 *
 * **Usage:**
 * Called repeatedly by `EdgeExpansionGapFillSubSolver._step()` until it returns `false`
 * (indicating all obstacles are processed). The BaseSolver framework handles the
 * iteration loop for incremental solving.
 *
 * @param state - Mutable state object tracking current obstacle, nodes, expansion progress
 * @returns `true` if more work remains (keep calling), `false` if all obstacles processed
 *
 * @internal This is an internal function used by EdgeExpansionGapFillSubSolver
 */
export function stepExpansion(state: EdgeExpansionGapFillState): boolean {
  // If we're done processing all obstacles, mark as done
  if (state.currentObstacleIndex >= state.edgeExpansionObstacles.length) {
    state.phase = "DONE"
    return false
  }

  // If we have no nodes for current obstacle, create them
  if (state.nodes.length === 0 && state.currentRound.length === 0) {
    // Get the current obstacle from the sorted array
    const obstacle = state.edgeExpansionObstacles[state.currentObstacleIndex]

    if (!obstacle) {
      // No more obstacles to process
      state.currentObstacleIndex++
      return true
    }

    // Estimate min trace width from board size
    const minTraceWidth =
      Math.min(state.bounds.width, state.bounds.height) *
      state.options.estimatedMinTraceWidthFactor

    // Create single-layer nodes for each of the 4 edge positions around the obstacle
    const allNodes = createNodesFromObstacle({
      obstacle: obstacle.rect,
      obstacleIndex: state.currentObstacleIndex,
      layerCount: state.layerCount,
      obstaclesByLayer: state.obstacles,
      minTraceWidth,
      initialEdgeThicknessFactor: state.options.initialEdgeThicknessFactor,
    })

    // VALIDATE: Check if initial nodes overlap with parent obstacle
    validateInitialNodes({
      nodes: allNodes,
      obstacles: state.obstacles,
    })

    // Filter out nodes that overlap with existing capacity nodes, obstacles, or previously placed gap-fill nodes
    // Now checks per-layer since nodes are single-layer
    const validNodes = filterOverlappingNodes({
      nodes: allNodes,
      existingPlacedByLayer: state.existingPlacedByLayer,
      obstaclesByLayer: state.obstacles,
      newPlaced: state.newPlaced,
    })

    if (validNodes.length === 0) {
      // No valid nodes for this obstacle, move to next
      state.currentObstacleIndex++
      return true
    }

    state.nodes = validNodes
    state.currentRound = []
    state.currentRoundIndex = 0
    state.currentDirection = null
  }

  // If current round is empty, start a new round
  if (state.currentRound.length === 0) {
    // Calculate potential area for each node in each direction
    const candidates: Array<{
      node: GapFillNode
      direction: Direction
      potentialArea: number
    }> = []

    for (const node of state.nodes) {
      if (!node.canExpand) continue

      // Determine forbidden direction (toward parent obstacle)
      const forbiddenDirection = getOppositeDirection(node.direction)

      for (const direction of ALL_DIRECTIONS) {
        // Skip direction that points toward parent obstacle
        if (direction === forbiddenDirection) {
          continue
        }

        let available = calculateAvailableSpace({ node, direction }, state)

        // Skip if no space available
        if (available < state.options.minRequiredExpandSpace) {
          continue
        }

        // Clamp expansion to respect aspect ratio
        const maxExpansion = calculateMaxExpansion({
          currentWidth: node.rect.width,
          currentHeight: node.rect.height,
          direction,
          available,
          maxAspectRatio: state.options.maxAspectRatio,
        })

        // Use clamped expansion amount
        available = maxExpansion

        if (available < state.options.minRequiredExpandSpace) {
          continue
        }

        // Determine minimum size based on layer count
        const isMultiLayer =
          node.zLayers.length >= state.options.minMulti.minLayers
        const minWidth = isMultiLayer
          ? state.options.minMulti.width
          : state.options.minSingle.width
        const minHeight = isMultiLayer
          ? state.options.minMulti.height
          : state.options.minSingle.height

        // Check if expanding would result in a valid node
        // We need to check BOTH dimensions, not just the one being expanded
        let newWidth = node.rect.width
        let newHeight = node.rect.height

        if (direction === "left" || direction === "right") {
          newWidth += available
        } else {
          newHeight += available
        }

        // Both dimensions must meet minimum requirements
        if (newWidth < minWidth || newHeight < minHeight) {
          continue
        }

        const potentialArea = calculatePotentialArea({ node, direction }, state)

        if (potentialArea > 0) {
          candidates.push({ node, direction, potentialArea })
        }
      }
    }

    if (candidates.length === 0) {
      // No more expansion possible for this obstacle

      // Do a final merge pass on all remaining nodes
      // This catches cases where multiple nodes finished expanding at the same time
      for (const node of state.nodes) {
        if (node.zLayers.length > 0) {
          mergeAdjacentLayerNodes({ node, allNodes: state.nodes })
        }
      }

      // Remove nodes that were merged (empty zLayers), never expanded, or below minimum size
      const finalNodes = state.nodes.filter((node) => {
        if (node.zLayers.length === 0) {
          return false
        }

        if (!node.hasEverExpanded) {
          return false
        }

        // Check if node meets minimum size requirements
        const isMultiLayer =
          node.zLayers.length >= state.options.minMulti.minLayers
        const minWidth = isMultiLayer
          ? state.options.minMulti.width
          : state.options.minSingle.width
        const minHeight = isMultiLayer
          ? state.options.minMulti.height
          : state.options.minSingle.height

        const meetsMinimum =
          node.rect.width >= minWidth && node.rect.height >= minHeight

        // Log removed if needed for debugging

        return meetsMinimum
      })

      // VALIDATION: Ensure no overlaps exist (should never happen, will throw if it does)
      validateNoOverlaps({ nodes: finalNodes, state })

      // Add remaining valid nodes to newPlaced
      for (const node of finalNodes) {
        state.newPlaced.push({
          rect: { ...node.rect },
          zLayers: [...node.zLayers],
        })
      }

      // Move to next obstacle
      state.nodes = []
      state.currentRound = []
      state.currentRoundIndex = 0
      state.currentDirection = null
      state.currentNodeId = null
      state.currentObstacleIndex++
      return true
    }

    // Sort by potential area (descending)
    candidates.sort((a, b) => b.potentialArea - a.potentialArea)

    // Group by node for this round
    const seenNodeIds = new Set<string>()
    const roundNodes: GapFillNode[] = []

    for (const candidate of candidates) {
      if (!seenNodeIds.has(candidate.node.id)) {
        seenNodeIds.add(candidate.node.id)
        roundNodes.push(candidate.node)
      }
    }

    state.currentRound = roundNodes
    state.currentRoundIndex = 0
    state.currentDirection = null
  }

  // Process one node in one direction
  if (state.currentRoundIndex >= state.currentRound.length) {
    // Round complete
    // Remove merged nodes (those with empty zLayers) from state.nodes
    state.nodes = state.nodes.filter((node) => node.zLayers.length > 0)

    // Start new round
    state.currentRound = []
    state.currentRoundIndex = 0
    state.currentDirection = null
    state.currentNodeId = null
    return true
  }

  const currentNode = state.currentRound[state.currentRoundIndex]!

  // If we haven't chosen a direction yet, pick the best one
  if (state.currentDirection === null) {
    let bestDirection: Direction | null = null
    let bestPotentialArea = 0

    // Determine forbidden direction (toward parent obstacle)
    const forbiddenDirection = getOppositeDirection(currentNode.direction)

    for (const direction of ALL_DIRECTIONS) {
      // Skip direction that points toward parent obstacle
      if (direction === forbiddenDirection) {
        continue
      }

      let available = calculateAvailableSpace(
        { node: currentNode, direction },
        state,
      )

      if (available < state.options.minRequiredExpandSpace) continue

      // Clamp expansion to respect aspect ratio
      const maxExpansion = calculateMaxExpansion({
        currentWidth: currentNode.rect.width,
        currentHeight: currentNode.rect.height,
        direction,
        available,
        maxAspectRatio: state.options.maxAspectRatio,
      })

      // Use clamped expansion amount
      available = maxExpansion

      if (available < state.options.minRequiredExpandSpace) continue

      // Determine minimum size based on layer count
      const isMultiLayer =
        currentNode.zLayers.length >= state.options.minMulti.minLayers
      const minWidth = isMultiLayer
        ? state.options.minMulti.width
        : state.options.minSingle.width
      const minHeight = isMultiLayer
        ? state.options.minMulti.height
        : state.options.minSingle.height

      // Check if expanding would result in a valid node
      // We need to check BOTH dimensions, not just the one being expanded
      let newWidth = currentNode.rect.width
      let newHeight = currentNode.rect.height

      if (direction === "left" || direction === "right") {
        newWidth += available
      } else {
        newHeight += available
      }

      // Both dimensions must meet minimum requirements
      if (newWidth < minWidth || newHeight < minHeight) {
        continue
      }

      const potentialArea = calculatePotentialArea(
        { node: currentNode, direction },
        state,
      )

      if (potentialArea > bestPotentialArea) {
        bestPotentialArea = potentialArea
        bestDirection = direction
      }
    }

    if (bestDirection === null) {
      // No valid direction, this node is done expanding
      currentNode.canExpand = false

      // Try to merge with adjacent layer nodes
      mergeAdjacentLayerNodes({ node: currentNode, allNodes: state.nodes })

      // Move to next node
      state.currentRoundIndex++
      state.currentDirection = null
      state.currentNodeId = null
      return true
    }

    state.currentDirection = bestDirection
    state.currentNodeId = currentNode.id
  }

  // Expand in the chosen direction
  let available = calculateAvailableSpace(
    { node: currentNode, direction: state.currentDirection },
    state,
  )

  // Clamp expansion to respect aspect ratio
  const maxExpansion = calculateMaxExpansion({
    currentWidth: currentNode.rect.width,
    currentHeight: currentNode.rect.height,
    direction: state.currentDirection,
    available,
    maxAspectRatio: state.options.maxAspectRatio,
  })

  // Use clamped expansion amount
  available = maxExpansion

  if (available >= state.options.minRequiredExpandSpace) {
    const oldWidth = currentNode.rect.width
    const oldHeight = currentNode.rect.height

    expandNode({
      node: currentNode,
      direction: state.currentDirection,
      amount: available,
    })

    // Mark that this node has successfully expanded
    currentNode.hasEverExpanded = true

    // Check if we hit aspect ratio limit and have remaining space
    const originalAvailable = calculateAvailableSpace(
      { node: currentNode, direction: state.currentDirection },
      state,
    )
    const remainingSpace = originalAvailable - available

    if (remainingSpace >= state.options.minRequiredExpandSpace) {
      // Spawn child node in the remaining gap
      // Calculate child node position and size
      // Use estimated min trace width to calculate initial thickness for child nodes
      const minTraceWidth =
        Math.min(state.bounds.width, state.bounds.height) *
        state.options.estimatedMinTraceWidthFactor
      const EDGE_THICKNESS =
        minTraceWidth * state.options.initialEdgeThicknessFactor
      let childRect: XYRect

      if (state.currentDirection === "up") {
        childRect = {
          x: currentNode.rect.x,
          y: currentNode.rect.y + currentNode.rect.height,
          width: currentNode.rect.width,
          height: EDGE_THICKNESS,
        }
      } else if (state.currentDirection === "down") {
        childRect = {
          x: currentNode.rect.x,
          y: currentNode.rect.y - EDGE_THICKNESS,
          width: currentNode.rect.width,
          height: EDGE_THICKNESS,
        }
      } else if (state.currentDirection === "right") {
        childRect = {
          x: currentNode.rect.x + currentNode.rect.width,
          y: currentNode.rect.y,
          width: EDGE_THICKNESS,
          height: currentNode.rect.height,
        }
      } else {
        // left
        childRect = {
          x: currentNode.rect.x - EDGE_THICKNESS,
          y: currentNode.rect.y,
          width: EDGE_THICKNESS,
          height: currentNode.rect.height,
        }
      }

      const childNode: GapFillNode = {
        id: `${currentNode.id}_child${Date.now()}`,
        rect: childRect,
        zLayers: [...currentNode.zLayers],
        direction: currentNode.direction,
        obstacleIndex: currentNode.obstacleIndex,
        canExpand: true,
        hasEverExpanded: false,
      }

      // Validate child doesn't overlap
      const childOverlaps =
        // Check existing placed
        state.existingPlacedByLayer.some(
          (layer, z) =>
            childNode.zLayers.includes(z) &&
            layer?.some((existing) => overlaps(childNode.rect, existing)),
        ) ||
        // Check obstacles
        state.obstacles.some(
          (layer, z) =>
            childNode.zLayers.includes(z) &&
            layer?.some((obs) => overlaps(childNode.rect, obs)),
        ) ||
        // Check other nodes
        state.nodes.some(
          (n) => n.id !== childNode.id && overlaps(childNode.rect, n.rect),
        ) ||
        // Check newPlaced
        state.newPlaced.some(
          (placed) =>
            childNode.zLayers.some((z) => placed.zLayers.includes(z)) &&
            overlaps(childNode.rect, placed.rect),
        )

      if (!childOverlaps) {
        state.nodes.push(childNode)
      }
    }
  }

  // Move to next node
  state.currentRoundIndex++
  state.currentDirection = null
  state.currentNodeId = null

  return true
}
