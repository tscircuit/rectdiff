// lib/solvers/rectdiff/edge-expansion-gapfill/stepExpansion.ts
import type { EdgeExpansionGapFillState, Direction, GapFillNode } from "./types"
import type { XYRect, Placed3D } from "../types"
import { createNodesFromObstacle } from "./createNodesFromObstacle"
import { filterOverlappingNodes } from "./filterOverlappingNodes"
import { calculateAvailableSpace } from "./calculateAvailableSpace"
import { calculatePotentialArea } from "./calculatePotentialArea"
import { calculateMaxExpansion } from "./calculateMaxExpansion"
import { expandNode } from "./expandNode"
import { mergeAdjacentLayerNodes } from "./mergeAdjacentLayerNodes"
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
 * 1. **INIT_NODES**: When starting a new obstacle, creates 4 tiny seed rectangles
 *    (one at each edge: top, bottom, left, right) around the obstacle. Filters out
 *    nodes that would immediately overlap with existing capacity nodes or obstacles.
 *
 * 2. **PLAN_ROUND**: For each active node, evaluates all possible expansion
 *    directions (except the one pointing toward the parent obstacle). Calculates
 *    available space, respects aspect ratio constraints, and selects the best
 *    expansion candidate based on potential area gained.
 *
 * 3. **CHOOSE_DIRECTION**: Picks the best expansion direction for the current node
 *    based on potential area calculations.
 *
 * 4. **EXPAND_NODE**: Expands one node in one direction by the calculated amount.
 *    If aspect ratio limits are hit but space remains, spawns child nodes to fill
 *    the remaining gap. This allows recursive gap filling.
 *
 * 5. **FINALIZE_OBSTACLE**: When a node can no longer expand, merges it with adjacent-layer
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
  // Check if we're completely done
  if (state.currentObstacleIndex >= state.edgeExpansionObstacles.length) {
    state.phase = "DONE"
    return false
  }

  // State machine: handle current processing phase
  switch (state.processingPhase) {
    case "INIT_NODES":
      return handleInitNodes(state)

    case "PLAN_ROUND":
      return handlePlanRound(state)

    case "CHOOSE_DIRECTION":
      return handleChooseDirection(state)

    case "EXPAND_NODE":
      return handleExpandNode(state)

    case "FINALIZE_OBSTACLE":
      return handleFinalizeObstacle(state)

    default:
      // Should never happen
      throw new Error(`Unknown processing phase: ${state.processingPhase}`)
  }
}

/**
 * Phase 1: Initialize nodes for the current obstacle
 */
function handleInitNodes(state: EdgeExpansionGapFillState): boolean {
  // Get the current obstacle
  const obstacle = state.edgeExpansionObstacles[state.currentObstacleIndex]

  if (!obstacle) {
    // No obstacle at this index, skip to next
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

  // Filter out nodes that overlap with existing capacity nodes, obstacles, or previously placed gap-fill nodes
  const validNodes = filterOverlappingNodes({
    nodes: allNodes,
    existingPlacedByLayer: state.existingPlacedByLayer,
    obstaclesByLayer: state.obstacles,
    newPlaced: state.newPlaced,
  })

  if (validNodes.length === 0) {
    // No valid nodes for this obstacle, skip to next
    state.currentObstacleIndex++
    // Stay in INIT_NODES phase for the next obstacle
    return true
  }

  // We have valid nodes, prepare for expansion
  state.nodes = validNodes
  state.currentRound = []
  state.currentRoundIndex = 0
  state.currentDirection = null

  // Transition to planning phase
  state.processingPhase = "PLAN_ROUND"
  return true
}

/**
 * Phase 2: Plan the next round of expansions
 */
function handlePlanRound(state: EdgeExpansionGapFillState): boolean {
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
    // No more expansion possible, finalize this obstacle
    state.processingPhase = "FINALIZE_OBSTACLE"
    return true
  }

  // Sort by potential area (descending)
  candidates.sort((a, b) => b.potentialArea - a.potentialArea)

  // Group by node for this round (one expansion per node per round)
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

  // Transition to choosing direction for first node
  state.processingPhase = "CHOOSE_DIRECTION"
  return true
}

/**
 * Phase 3: Choose the best expansion direction for the current node
 */
function handleChooseDirection(state: EdgeExpansionGapFillState): boolean {
  // Check if we've processed all nodes in this round
  if (state.currentRoundIndex >= state.currentRound.length) {
    // Round complete - remove merged nodes and start a new round
    state.nodes = state.nodes.filter((node) => node.zLayers.length > 0)
    state.currentRound = []
    state.currentRoundIndex = 0
    state.currentDirection = null
    state.currentNodeId = null

    // Transition back to planning
    state.processingPhase = "PLAN_ROUND"
    return true
  }

  const currentNode = state.currentRound[state.currentRoundIndex]!

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

    // Move to next node in the round
    state.currentRoundIndex++
    state.currentDirection = null
    state.currentNodeId = null

    // Stay in CHOOSE_DIRECTION phase to process next node
    return true
  }

  // We found a direction, prepare to expand
  state.currentDirection = bestDirection
  state.currentNodeId = currentNode.id

  // Transition to expansion
  state.processingPhase = "EXPAND_NODE"
  return true
}

/**
 * Phase 4: Expand the current node in the chosen direction
 */
function handleExpandNode(state: EdgeExpansionGapFillState): boolean {
  const currentNode = state.currentRound[state.currentRoundIndex]!

  if (!state.currentDirection) {
    throw new Error("EXPAND_NODE phase but no direction selected")
  }

  // Calculate available space
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
    // Perform the expansion
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
      spawnChildNode(state, currentNode, state.currentDirection)
    }
  }

  // Move to next node in the round
  state.currentRoundIndex++
  state.currentDirection = null
  state.currentNodeId = null

  // Transition back to choosing direction for next node
  state.processingPhase = "CHOOSE_DIRECTION"
  return true
}

/**
 * Phase 5: Finalize the current obstacle (merge nodes, add to output, move to next obstacle)
 */
function handleFinalizeObstacle(state: EdgeExpansionGapFillState): boolean {
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
    const isMultiLayer = node.zLayers.length >= state.options.minMulti.minLayers
    const minWidth = isMultiLayer
      ? state.options.minMulti.width
      : state.options.minSingle.width
    const minHeight = isMultiLayer
      ? state.options.minMulti.height
      : state.options.minSingle.height

    const meetsMinimum =
      node.rect.width >= minWidth && node.rect.height >= minHeight

    return meetsMinimum
  })

  // Add remaining valid nodes to newPlaced
  for (const node of finalNodes) {
    state.newPlaced.push({
      rect: { ...node.rect },
      zLayers: [...node.zLayers],
    })
  }

  // Reset state for next obstacle
  state.nodes = []
  state.currentRound = []
  state.currentRoundIndex = 0
  state.currentDirection = null
  state.currentNodeId = null
  state.currentObstacleIndex++

  // Transition back to initializing nodes for next obstacle
  state.processingPhase = "INIT_NODES"
  return true
}

/**
 * Helper: Spawn a child node to fill remaining gap after aspect ratio limit
 */
function spawnChildNode(
  state: EdgeExpansionGapFillState,
  parentNode: GapFillNode,
  direction: Direction,
): void {
  // Use estimated min trace width to calculate initial thickness for child nodes
  const minTraceWidth =
    Math.min(state.bounds.width, state.bounds.height) *
    state.options.estimatedMinTraceWidthFactor
  const EDGE_THICKNESS =
    minTraceWidth * state.options.initialEdgeThicknessFactor

  let childRect: XYRect

  if (direction === "up") {
    childRect = {
      x: parentNode.rect.x,
      y: parentNode.rect.y + parentNode.rect.height,
      width: parentNode.rect.width,
      height: EDGE_THICKNESS,
    }
  } else if (direction === "down") {
    childRect = {
      x: parentNode.rect.x,
      y: parentNode.rect.y - EDGE_THICKNESS,
      width: parentNode.rect.width,
      height: EDGE_THICKNESS,
    }
  } else if (direction === "right") {
    childRect = {
      x: parentNode.rect.x + parentNode.rect.width,
      y: parentNode.rect.y,
      width: EDGE_THICKNESS,
      height: parentNode.rect.height,
    }
  } else {
    // left
    childRect = {
      x: parentNode.rect.x - EDGE_THICKNESS,
      y: parentNode.rect.y,
      width: EDGE_THICKNESS,
      height: parentNode.rect.height,
    }
  }

  const childNode: GapFillNode = {
    id: `${parentNode.id}_child${Date.now()}`,
    rect: childRect,
    zLayers: [...parentNode.zLayers],
    direction: parentNode.direction,
    obstacleIndex: parentNode.obstacleIndex,
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
