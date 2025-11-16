import React, { useState, useEffect, useRef } from "react"
import { Play, Square, SkipForward } from "lucide-react"

const RectFillVisualizer = () => {
  const canvasRef = useRef(null)

  const GRID_PROGRESSION = [100, 50, 20]
  const MIN_RECT_SIZE_IN_CELL_RATIO = 0.2

  const [maxRatio, setMaxRatio] = useState(2)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [fillRects, setFillRects] = useState([])
  const [candidatePoints, setCandidatePoints] = useState([])
  const [expansionPhase, setExpansionPhase] = useState(false)
  const [expansionIndex, setExpansionIndex] = useState(0)
  const [gapFillingPhase, setGapFillingPhase] = useState(false)
  const [gapCandidates, setGapCandidates] = useState([])
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
      [rect.x, rect.y, rect.x + rect.width, rect.y],
      [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
      [rect.x, rect.y + rect.height, rect.x, rect.y],
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

        // Check if point is inside any blocker
        let insideBlocker = false

        for (const blocker of allBlockers) {
          if (isPointInRect(x, y, blocker)) {
            insideBlocker = true
            const remainingHeight = blocker.y + blocker.height - y
            const skipAmount = Math.max(
              0,
              Math.floor(remainingHeight / gridSize),
            )
            if (skipAmount > 0) {
              y += (skipAmount - 1) * gridSize
            }
            break
          }
        }

        if (insideBlocker) {
          continue
        }

        let minDist = distanceToRect(x, y, outerBorder)

        for (const obs of obstacles) {
          const dist = distanceToRect(x, y, obs)
          minDist = Math.min(minDist, dist)
        }

        points.push({ x, y, distance: minDist })
      }
    }

    return points.sort((a, b) => b.distance - a.distance)
  }

  const findGapCandidates = (rects) => {
    const allBlockers = [...obstacles, ...rects]
    const gapPoints = []
    const sampleStep = 10

    rects.forEach((rect, rectIdx) => {
      const edges = [
        {
          name: "right",
          points: () => {
            const pts = []
            for (let y = rect.y; y <= rect.y + rect.height; y += sampleStep) {
              pts.push({
                x: rect.x + rect.width + 1,
                y: Math.min(y, rect.y + rect.height),
              })
            }
            return pts
          },
        },
        {
          name: "bottom",
          points: () => {
            const pts = []
            for (let x = rect.x; x <= rect.x + rect.width; x += sampleStep) {
              pts.push({
                x: Math.min(x, rect.x + rect.width),
                y: rect.y + rect.height + 1,
              })
            }
            return pts
          },
        },
        {
          name: "left",
          points: () => {
            const pts = []
            for (let y = rect.y; y <= rect.y + rect.height; y += sampleStep) {
              pts.push({ x: rect.x - 1, y: Math.min(y, rect.y + rect.height) })
            }
            return pts
          },
        },
        {
          name: "top",
          points: () => {
            const pts = []
            for (let x = rect.x; x <= rect.x + rect.width; x += sampleStep) {
              pts.push({ x: Math.min(x, rect.x + rect.width), y: rect.y - 1 })
            }
            return pts
          },
        },
      ]

      edges.forEach((edge) => {
        const edgePoints = edge.points()

        edgePoints.forEach((point) => {
          if (
            point.x < outerBorder.x ||
            point.x > outerBorder.x + outerBorder.width ||
            point.y < outerBorder.y ||
            point.y > outerBorder.y + outerBorder.height
          ) {
            return
          }

          let isOccupied = false
          for (const blocker of allBlockers) {
            if (blocker === rect) continue
            if (isPointInRect(point.x, point.y, blocker)) {
              isOccupied = true
              break
            }
          }

          if (!isOccupied) {
            gapPoints.push({ x: point.x, y: point.y, sourceRect: rectIdx })
          }
        })
      })
    })

    return gapPoints
  }

  const expandExistingRect = (existingRect, existingRects = []) => {
    let rect = { ...existingRect }
    const allBlockers = [...obstacles, ...existingRects]

    let improved = true

    while (improved) {
      improved = false

      const maxRight = outerBorder.x + outerBorder.width - (rect.x + rect.width)
      if (maxRight > 0) {
        let bestExpansion = 0

        for (let expand = 1; expand <= maxRight; expand++) {
          let testRect = { ...rect, width: rect.width + expand }

          let hasCollision = false
          for (const blocker of allBlockers) {
            if (rectOverlaps(testRect, blocker)) {
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

      const maxDown =
        outerBorder.y + outerBorder.height - (rect.y + rect.height)
      if (maxDown > 0) {
        let bestExpansion = 0

        for (let expand = 1; expand <= maxDown; expand++) {
          let testRect = { ...rect, height: rect.height + expand }

          let hasCollision = false
          for (const blocker of allBlockers) {
            if (rectOverlaps(testRect, blocker)) {
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

          let hasCollision = false
          for (const blocker of allBlockers) {
            if (rectOverlaps(testRect, blocker)) {
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

          let hasCollision = false
          for (const blocker of allBlockers) {
            if (rectOverlaps(testRect, blocker)) {
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

    return rect
  }

  const expandRect = (
    startX,
    startY,
    gridSize,
    maxRatio,
    existingRects = [],
  ) => {
    const minSize = Math.max(1, gridSize * MIN_RECT_SIZE_IN_CELL_RATIO)

    const strategies = [
      { startOffsetX: 0, startOffsetY: 0 },
      { startOffsetX: -minSize, startOffsetY: 0 },
      { startOffsetX: 0, startOffsetY: -minSize },
      { startOffsetX: -minSize, startOffsetY: -minSize },
      { startOffsetX: -minSize / 2, startOffsetY: -minSize / 2 },
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

      if (
        rect.x < outerBorder.x ||
        rect.y < outerBorder.y ||
        rect.x + rect.width > outerBorder.x + outerBorder.width ||
        rect.y + rect.height > outerBorder.y + outerBorder.height
      ) {
        continue
      }

      let hasOverlap =
        obstacles.some((obs) => rectOverlaps(rect, obs)) ||
        existingRects.some((fr) => rectOverlaps(rect, fr))

      if (hasOverlap) continue

      const allBlockers = [...obstacles, ...existingRects]

      let improved = true

      while (improved) {
        improved = false

        const maxRight =
          outerBorder.x + outerBorder.width - (rect.x + rect.width)
        if (maxRight > 0) {
          let bestExpansion = 0

          for (let expand = 1; expand <= maxRight; expand++) {
            let testRect = { ...rect, width: rect.width + expand }

            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
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

        const maxDown =
          outerBorder.y + outerBorder.height - (rect.y + rect.height)
        if (maxDown > 0) {
          let bestExpansion = 0

          for (let expand = 1; expand <= maxDown; expand++) {
            let testRect = { ...rect, height: rect.height + expand }

            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
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

            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
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

            if (maxRatio !== null && maxRatio !== undefined) {
              const ratio = Math.max(
                testRect.width / testRect.height,
                testRect.height / testRect.width,
              )
              if (ratio > maxRatio) break
            }

            let hasCollision = false
            for (const blocker of allBlockers) {
              if (rectOverlaps(testRect, blocker)) {
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

  const step = () => {
    if (!expansionPhase && !gapFillingPhase && candidatePoints.length === 0) {
      if (currentGridIndex < GRID_PROGRESSION.length - 1) {
        const nextGridIndex = currentGridIndex + 1
        const nextGridSize = GRID_PROGRESSION[nextGridIndex]
        setCurrentGridIndex(nextGridIndex)
        setCurrentGridSize(nextGridSize)
        const newCandidates = computeCandidatePoints(nextGridSize, fillRects)
        setCandidatePoints(newCandidates)
        return
      } else {
        setExpansionPhase(true)
        setExpansionIndex(0)
        return
      }
    }

    if (gapFillingPhase) {
      if (gapCandidates.length === 0) return

      const point = gapCandidates[0]
      const newRect = expandRect(point.x, point.y, 5, null, fillRects)

      if (newRect) {
        const newFillRects = [...fillRects, newRect]
        setFillRects(newFillRects)

        const remainingGaps = gapCandidates.filter(
          (p) => !isPointInRect(p.x, p.y, newRect),
        )
        setGapCandidates(remainingGaps)
      } else {
        setGapCandidates(gapCandidates.slice(1))
      }

      setCurrentStep(currentStep + 1)
    } else if (expansionPhase) {
      if (expansionIndex >= fillRects.length) {
        const gaps = findGapCandidates(fillRects)
        setGapCandidates(gaps)
        setGapFillingPhase(true)
        setExpansionPhase(false)
        return
      }

      const rectToExpand = fillRects[expansionIndex]
      const otherRects = fillRects.filter((_, i) => i !== expansionIndex)

      const expandedRect = expandExistingRect(rectToExpand, otherRects)

      if (expandedRect) {
        const newFillRects = [...fillRects]
        newFillRects[expansionIndex] = expandedRect
        setFillRects(newFillRects)
      }

      setExpansionIndex(expansionIndex + 1)
    } else {
      const point = candidatePoints[0]
      const newRect = expandRect(
        point.x,
        point.y,
        currentGridSize,
        maxRatio,
        fillRects,
      )

      if (newRect) {
        const newFillRects = [...fillRects, newRect]
        setFillRects(newFillRects)

        const remainingCandidates = candidatePoints.filter(
          (p) => !isPointInRect(p.x, p.y, newRect),
        )
        setCandidatePoints(remainingCandidates)
      } else {
        setCandidatePoints(candidatePoints.slice(1))
      }

      setCurrentStep(currentStep + 1)
    }
  }

  const runAll = () => {
    setIsRunning(true)
    let rects = [...fillRects]
    let steps = currentStep

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

          remainingCandidates = remainingCandidates.filter(
            (p) => !isPointInRect(p.x, p.y, newRect),
          )
        } else {
          remainingCandidates = remainingCandidates.slice(1)
        }

        steps++
      }
    }

    for (let i = 0; i < rects.length; i++) {
      const rectToExpand = rects[i]
      const otherRects = rects.filter((_, idx) => idx !== i)
      const expandedRect = expandExistingRect(rectToExpand, otherRects)
      if (expandedRect) {
        rects[i] = expandedRect
      }
    }

    let gaps = findGapCandidates(rects)
    while (gaps.length > 0) {
      const point = gaps[0]
      const newRect = expandRect(point.x, point.y, 5, null, rects)

      if (newRect) {
        rects.push(newRect)
        gaps = gaps.filter((p) => !isPointInRect(p.x, p.y, newRect))
      } else {
        gaps = gaps.slice(1)
      }

      steps++

      if (steps > currentStep + 1000) break
    }

    setFillRects(rects)
    setCandidatePoints([])
    setGapCandidates([])
    setCurrentStep(steps)
    setCurrentGridIndex(GRID_PROGRESSION.length - 1)
    setCurrentGridSize(GRID_PROGRESSION[GRID_PROGRESSION.length - 1])
    setExpansionPhase(false)
    setGapFillingPhase(true)
    setExpansionIndex(rects.length)
    setIsRunning(false)
  }

  const reset = () => {
    setIsRunning(false)
    setCurrentStep(0)
    setFillRects([])
    setExpansionPhase(false)
    setGapFillingPhase(false)
    setExpansionIndex(0)
    setGapCandidates([])
    setCurrentGridIndex(0)
    const firstGridSize = GRID_PROGRESSION[0]
    setCurrentGridSize(firstGridSize)
    const points = computeCandidatePoints(firstGridSize, [])
    setCandidatePoints(points)
  }

  useEffect(() => {
    reset()
  }, [maxRatio])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 3
    ctx.strokeRect(
      outerBorder.x,
      outerBorder.y,
      outerBorder.width,
      outerBorder.height,
    )

    ctx.fillStyle = "#ef4444"
    obstacles.forEach((obs) => {
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
    })

    if (!expansionPhase && !gapFillingPhase && candidatePoints.length > 0) {
      ctx.fillStyle = "rgba(156, 163, 175, 0.3)"
      candidatePoints.forEach((point) => {
        ctx.fillRect(point.x - 1, point.y - 1, 2, 2)
      })
    }

    fillRects.forEach((rect, idx) => {
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

    if (gapFillingPhase && gapCandidates.length > 0) {
      ctx.fillStyle = "#ec4899"
      gapCandidates.forEach((point) => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

    if (!expansionPhase && !gapFillingPhase && candidatePoints.length > 0) {
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
    gapFillingPhase,
    gapCandidates,
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
          without ratio constraints. Finally, edge gaps are identified and
          filled with additional rectangles.
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
            disabled={gapFillingPhase && gapCandidates.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition"
          >
            <SkipForward size={20} />
            Step
          </button>

          <button
            onClick={runAll}
            disabled={isRunning}
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
            {gapFillingPhase
              ? "Gap Filling"
              : expansionPhase
                ? "Expansion"
                : `Candidates (${currentGridIndex + 1}/${GRID_PROGRESSION.length})`}
            {!expansionPhase && !gapFillingPhase && (
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
            {gapFillingPhase && (
              <>
                <span className="ml-4 text-gray-400">Gaps:</span>{" "}
                {gapCandidates.length}
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
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
              <span>Gap Candidates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RectFillVisualizer
