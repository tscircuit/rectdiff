import React, { useState, useEffect, useRef } from "react"
import { Play, Square, SkipForward } from "lucide-react"

const RectFillVisualizer = () => {
  const canvasRef = useRef(null)
  const GRID_PROGRESSION = [100, 50, 20]
  const MIN_RECT_SIZE_IN_CELL_RATIO = 0.2 // Start with rectangles 1/5 the grid size

  const [maxRatio, setMaxRatio] = useState(2)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [fillRects, setFillRects] = useState([])
  const [candidatePoints, setCandidatePoints] = useState([])
  const [expansionPhase, setExpansionPhase] = useState(false)
  const [expansionIndex, setExpansionIndex] = useState(0)
  const [currentGridIndex, setCurrentGridIndex] = useState(0)
  const [currentGridSize, setCurrentGridSize] = useState(GRID_PROGRESSION[0])

  // Example problem setup
  const outerBorder = { x: 50, y: 50, width: 700, height: 500 }
  const obstacles = [
    { x: 150, y: 100, width: 100, height: 80 },
    { x: 400, y: 150, width: 120, height: 100 },
    { x: 250, y: 300, width: 80, height: 120 },
    { x: 600, y: 250, width: 100, height: 150 },
  ]

  const pointToLineSegmentDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1
    const B = py - y1
    const C = x2 - x1
    const D = y2 - y1

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1

    if (lenSq !== 0) param = dot / lenSq

    let xx, yy

    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }

    const dx = px - xx
    const dy = py - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  const distanceToRect = (px, py, rect) => {
    const edges = [
      [rect.x, rect.y, rect.x + rect.width, rect.y], // top
      [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height], // right
      [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height], // bottom
      [rect.x, rect.y + rect.height, rect.x, rect.y], // left
    ]

    return Math.min(
      ...edges.map(([x1, y1, x2, y2]) =>
        pointToLineSegmentDistance(px, py, x1, y1, x2, y2),
      ),
    )
  }

  const isPointInRect = (px, py, rect) => {
    return (
      px >= rect.x &&
      px <= rect.x + rect.width &&
      py >= rect.y &&
      py <= rect.y + rect.height
    )
  }

  const rectOverlaps = (r1, r2) => {
    return !(
      r1.x + r1.width <= r2.x ||
      r2.x + r2.width <= r1.x ||
      r1.y + r1.height <= r2.y ||
      r2.y + r2.height <= r1.y
    )
  }

  const expandRect = (
    startX,
    startY,
    gridSize,
    maxRatio,
    existingRects = [],
  ) => {
    const minSize = Math.max(1, gridSize * MIN_RECT_SIZE_IN_CELL_RATIO)

    // Try different anchor positions for the start point
    const strategies = [
      { startOffsetX: 0, startOffsetY: 0 }, // top-left
      { startOffsetX: -minSize, startOffsetY: 0 }, // top-right
      { startOffsetX: 0, startOffsetY: -minSize }, // bottom-left
      { startOffsetX: -minSize, startOffsetY: -minSize }, // bottom-right
      { startOffsetX: -minSize / 2, startOffsetY: -minSize / 2 }, // centered
    ]

    let bestRect = null
    let bestArea = 0

    for (const strategy of strategies) {
      let rect = {
        x: startX + strategy.startOffsetX,
        y: startY + strategy.startOffsetY,
        width: minSize,
        height: minSize,
      }

      // Check if initial rectangle is valid
      if (
        rect.x < outerBorder.x ||
        rect.y < outerBorder.y ||
        rect.x + rect.width > outerBorder.x + outerBorder.width ||
        rect.y + rect.height > outerBorder.y + outerBorder.height
      ) {
        continue
      }

      // Check initial overlap
      let hasOverlap =
        obstacles.some((obs) => rectOverlaps(rect, obs)) ||
        existingRects.some((fr) => rectOverlaps(rect, fr))

      if (hasOverlap) continue

      const allBlockers = [...obstacles, ...existingRects]

      // Expand in each direction to maximum - never shrink any dimension
      let improved = true

      while (improved) {
        improved = false

        // Try expanding RIGHT (increase width only)
        const maxRight =
          outerBorder.x + outerBorder.width - (rect.x + rect.width)
        if (maxRight > 0) {
          let bestExpansion = 0

          for (let expand = 1; expand <= maxRight; expand++) {
            let testRect = { ...rect, width: rect.width + expand }

            // Check ratio
            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            // Check overlaps and snap to exact edge if collision
            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
                // Found collision - use the blocker's left edge as the limit
                const maxWidth = blocker.x - rect.x
                if (maxWidth > rect.width) {
                  bestExpansion = maxWidth - rect.width
                }
                hasCollision = true
                break
              }
            }

            if (hasCollision) break
            bestExpansion = expand
          }

          if (bestExpansion > 0) {
            rect.width += bestExpansion
            improved = true
          }
        }

        // Try expanding DOWN (increase height only)
        const maxDown =
          outerBorder.y + outerBorder.height - (rect.y + rect.height)
        if (maxDown > 0) {
          let bestExpansion = 0

          for (let expand = 1; expand <= maxDown; expand++) {
            let testRect = { ...rect, height: rect.height + expand }

            // Check ratio
            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            // Check overlaps and snap to exact edge if collision
            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
                // Found collision - use the blocker's top edge as the limit
                const maxHeight = blocker.y - rect.y
                if (maxHeight > rect.height) {
                  bestExpansion = maxHeight - rect.height
                }
                hasCollision = true
                break
              }
            }

            if (hasCollision) break
            bestExpansion = expand
          }

          if (bestExpansion > 0) {
            rect.height += bestExpansion
            improved = true
          }
        }

        // Try expanding LEFT (decrease x, increase width)
        const maxLeft = rect.x - outerBorder.x
        if (maxLeft > 0) {
          let bestExpansion = 0

          for (let expand = 1; expand <= maxLeft; expand++) {
            let testRect = {
              x: rect.x - expand,
              y: rect.y,
              width: rect.width + expand,
              height: rect.height,
            }

            // Check ratio
            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            // Check overlaps and snap to exact edge if collision
            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
                // Found collision - use the blocker's right edge as the limit
                const newLeft = blocker.x + blocker.width
                if (newLeft < rect.x) {
                  bestExpansion = rect.x - newLeft
                }
                hasCollision = true
                break
              }
            }

            if (hasCollision) break
            bestExpansion = expand
          }

          if (bestExpansion > 0) {
            rect.x -= bestExpansion
            rect.width += bestExpansion
            improved = true
          }
        }

        // Try expanding UP (decrease y, increase height)
        const maxUp = rect.y - outerBorder.y
        if (maxUp > 0) {
          let bestExpansion = 0

          for (let expand = 1; expand <= maxUp; expand++) {
            let testRect = {
              x: rect.x,
              y: rect.y - expand,
              width: rect.width,
              height: rect.height + expand,
            }

            // Check ratio
            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            // Check overlaps and snap to exact edge if collision
            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
                // Found collision - use the blocker's bottom edge as the limit
                const newTop = blocker.y + blocker.height
                if (newTop < rect.y) {
                  bestExpansion = rect.y - newTop
                }
                hasCollision = true
                break
              }
            }

            if (hasCollision) break
            bestExpansion = expand
          }

          if (bestExpansion > 0) {
            rect.y -= bestExpansion
            rect.height += bestExpansion
            improved = true
          }
        }
      }

      const area = rect.width * rect.height
      if (area > bestArea) {
        bestArea = area
        bestRect = rect
      }
    }

    return bestRect
  }

  const computeCandidatePoints = (gridSize, existingRects = []) => {
    const points = []
    const allBlockers = [...obstacles, ...existingRects]

    for (
      let x = outerBorder.x;
      x < outerBorder.x + outerBorder.width;
      x += gridSize
    ) {
      for (
        let y = outerBorder.y;
        y < outerBorder.y + outerBorder.height;
        y += gridSize
      ) {
        // Skip points along the border edges
        if (
          x === outerBorder.x ||
          y === outerBorder.y ||
          x >= outerBorder.x + outerBorder.width - gridSize ||
          y >= outerBorder.y + outerBorder.height - gridSize
        ) {
          continue
        }

        // Check if point is inside any blocker (obstacle or existing rect)
        let insideBlocker = false

        for (const blocker of allBlockers) {
          if (isPointInRect(x, y, blocker)) {
            insideBlocker = true
            // Calculate how many grid points we can skip based on blocker height
            const remainingHeight = blocker.y + blocker.height - y
            const skipAmount = Math.max(
              0,
              Math.floor(remainingHeight / gridSize),
            )
            if (skipAmount > 0) {
              y += (skipAmount - 1) * gridSize // Skip ahead (loop will add gridSize)
            }
            break
          }
        }

        if (insideBlocker) {
          continue
        }

        // Calculate distance to nearest obstacle or border
        let minDist = distanceToRect(x, y, outerBorder)

        for (const obs of obstacles) {
          const dist = distanceToRect(x, y, obs)
          minDist = Math.min(minDist, dist)
        }

        points.push({ x, y, distance: minDist })
      }
    }

    // Sort by distance descending (furthest from obstacles first)
    return points.sort((a, b) => b.distance - a.distance)
  }

  const reset = () => {
    setIsRunning(false)
    setCurrentStep(0)
    setFillRects([])
    setExpansionPhase(false)
    setExpansionIndex(0)
    setCurrentGridIndex(0)
    const firstGridSize = GRID_PROGRESSION[0]
    setCurrentGridSize(firstGridSize)
    const points = computeCandidatePoints(firstGridSize, [])
    setCandidatePoints(points)
  }

  useEffect(() => {
    reset()
  }, [maxRatio])

  const step = () => {
    if (!expansionPhase && candidatePoints.length === 0) {
      // Check if we can move to next grid size
      if (currentGridIndex < GRID_PROGRESSION.length - 1) {
        const nextGridIndex = currentGridIndex + 1
        const nextGridSize = GRID_PROGRESSION[nextGridIndex]
        setCurrentGridIndex(nextGridIndex)
        setCurrentGridSize(nextGridSize)
        const newCandidates = computeCandidatePoints(nextGridSize, fillRects)
        setCandidatePoints(newCandidates)
        return
      } else {
        // All grids processed, enter expansion phase
        setExpansionPhase(true)
        setExpansionIndex(0)
        return
      }
    }

    if (expansionPhase) {
      // Expansion phase: try to expand existing rectangles without ratio constraint
      if (expansionIndex >= fillRects.length) return

      const rectToExpand = fillRects[expansionIndex]
      const otherRects = fillRects.filter((_, i) => i !== expansionIndex)

      const expandedRect = expandRect(
        rectToExpand.x,
        rectToExpand.y,
        currentGridSize,
        null,
        otherRects,
      )

      if (expandedRect) {
        const newFillRects = [...fillRects]
        newFillRects[expansionIndex] = expandedRect
        setFillRects(newFillRects)
      }

      setExpansionIndex(expansionIndex + 1)
    } else {
      // Candidate phase: process next candidate point
      const point = candidatePoints[0]
      const newRect = expandRect(
        point.x,
        point.y,
        currentGridSize,
        maxRatio,
        fillRects,
      )

      // Only add if we successfully created a rectangle
      if (newRect) {
        // Add the new rectangle
        const newFillRects = [...fillRects, newRect]
        setFillRects(newFillRects)

        // Filter out all candidate points that are now inside this rectangle
        const remainingCandidates = candidatePoints.filter(
          (p) => !isPointInRect(p.x, p.y, newRect),
        )
        setCandidatePoints(remainingCandidates)
      } else {
        // Couldn't create a rect from this point, just remove it
        setCandidatePoints(candidatePoints.slice(1))
      }

      setCurrentStep(currentStep + 1)
    }
  }

  const runAll = () => {
    setIsRunning(true)
    let rects = [...fillRects]
    let steps = currentStep

    // Phase 1: Process all grid sizes progressively
    for (
      let gridIdx = currentGridIndex;
      gridIdx < GRID_PROGRESSION.length;
      gridIdx++
    ) {
      const gridSize = GRID_PROGRESSION[gridIdx]
      let remainingCandidates = computeCandidatePoints(gridSize, rects)

      while (remainingCandidates.length > 0) {
        const point = remainingCandidates[0]
        const newRect = expandRect(point.x, point.y, gridSize, maxRatio, rects)

        if (newRect) {
          rects.push(newRect)

          // Filter out all candidates inside the new rectangle
          remainingCandidates = remainingCandidates.filter(
            (p) => !isPointInRect(p.x, p.y, newRect),
          )
        } else {
          // Couldn't create a rect, just remove this candidate
          remainingCandidates = remainingCandidates.slice(1)
        }

        steps++
      }
    }

    // Phase 2: Expansion phase - expand all rects without ratio constraint
    const finalGridSize = GRID_PROGRESSION[GRID_PROGRESSION.length - 1]
    for (let i = 0; i < rects.length; i++) {
      const rectToExpand = rects[i]
      const otherRects = rects.filter((_, idx) => idx !== i)
      const expandedRect = expandRect(
        rectToExpand.x,
        rectToExpand.y,
        finalGridSize,
        null,
        otherRects,
      )
      if (expandedRect) {
        rects[i] = expandedRect
      }
    }

    setFillRects(rects)
    setCandidatePoints([])
    setCurrentStep(steps)
    setCurrentGridIndex(GRID_PROGRESSION.length - 1)
    setCurrentGridSize(finalGridSize)
    setExpansionPhase(true)
    setExpansionIndex(rects.length)
    setIsRunning(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw outer border (green)
    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 3
    ctx.strokeRect(
      outerBorder.x,
      outerBorder.y,
      outerBorder.width,
      outerBorder.height,
    )

    // Draw obstacles (red)
    ctx.fillStyle = "#ef4444"
    obstacles.forEach((obs) => {
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
    })

    // Draw candidate grid points (only in candidate phase, with transparency)
    if (!expansionPhase && candidatePoints.length > 0) {
      ctx.fillStyle = "rgba(156, 163, 175, 0.3)"
      candidatePoints.forEach((point) => {
        ctx.fillRect(point.x - 1, point.y - 1, 2, 2)
      })
    }

    // Draw fill rects (blue)
    fillRects.forEach((rect, idx) => {
      // Highlight the rect being expanded in expansion phase
      if (expansionPhase && idx === expansionIndex - 1) {
        ctx.fillStyle = "rgba(251, 191, 36, 0.5)"
        ctx.strokeStyle = "#fbbf24"
        ctx.lineWidth = 2
      } else {
        ctx.fillStyle = "rgba(59, 130, 246, 0.5)"
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 1
      }
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    })

    // Draw next candidate point (only in candidate phase)
    if (!expansionPhase && candidatePoints.length > 0) {
      const point = candidatePoints[0]
      ctx.fillStyle = "#fbbf24"
      ctx.beginPath()
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI)
      ctx.fill()
    }
  }, [
    fillRects,
    currentStep,
    candidatePoints,
    expansionPhase,
    expansionIndex,
    currentGridSize,
  ])

  return (
    <div className="w-full h-full bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Space-Filling Rectangle Algorithm
        </h1>
        <p className="text-gray-400 mb-6">
          Fills space with rectangles while avoiding obstacles using progressive
          grid refinement (100px → 50px → 20px). Points furthest from obstacles
          are prioritized. After all grids are processed, rectangles expand
          without ratio constraints to eliminate seams.
        </p>

        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border border-gray-700 rounded"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="block text-sm font-medium mb-2">
              Max Dimension Ratio: {maxRatio.toFixed(1)}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={maxRatio}
              onChange={(e) => setMaxRatio(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={step}
            disabled={expansionPhase && expansionIndex >= fillRects.length}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition"
          >
            <SkipForward size={20} />
            Step
          </button>

          <button
            onClick={runAll}
            disabled={
              (candidatePoints.length === 0 &&
                expansionPhase &&
                expansionIndex >= fillRects.length) ||
              isRunning
            }
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition"
          >
            <Play size={20} />
            Run All
          </button>

          <button
            onClick={reset}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
          >
            <Square size={20} />
            Reset
          </button>

          <div className="ml-auto bg-gray-800 px-4 py-2 rounded-lg">
            <span className="text-gray-400">Grid:</span> {currentGridSize}px
            <span className="ml-4 text-gray-400">Phase:</span>{" "}
            {expansionPhase
              ? "Expansion"
              : `Candidates (${currentGridIndex + 1}/${GRID_PROGRESSION.length})`}
            {!expansionPhase && (
              <>
                <span className="ml-4 text-gray-400">Remaining:</span>{" "}
                {candidatePoints.length}
              </>
            )}
            {expansionPhase && (
              <>
                <span className="ml-4 text-gray-400">Expanding:</span>{" "}
                {expansionIndex}/{fillRects.length}
              </>
            )}
            <span className="ml-4 text-gray-400">Rectangles:</span>{" "}
            {fillRects.length}
          </div>
        </div>

        <div className="mt-4 bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Legend:</h3>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-green-500"></div>
              <span>Outer Border</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500"></div>
              <span>Obstacles</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 opacity-30"></div>
              <span>Grid Candidates</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 opacity-50"></div>
              <span>Fill Rectangles</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <span>Next Candidate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-400 opacity-50 border border-yellow-400"></div>
              <span>Expanding Rectangle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RectFillVisualizer
