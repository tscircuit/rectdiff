import React, { useState, useEffect, useMemo } from "react"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { EdgeExpansionSolver } from "../lib/solvers/EdgeExpansionSolver"
import { EDGE_EXPANSION_CONFIG } from "../edge-expansion.config"

const GLOBAL_BOUNDS = { x: 50, y: 50, width: 700, height: 500 }

const EdgeExpansionInteractive = () => {
  const [obstacles, setObstacles] = useState<
    Array<{ x: number; y: number; width: number; height: number }>
  >([])
  const [iteration, setIteration] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [minExpandSpace, setMinExpandSpace] = useState(
    EDGE_EXPANSION_CONFIG.MIN_REQUIRED_EXPAND_SPACE,
  )

  const solver = useMemo(() => {
    if (obstacles.length === 0) return null

    const simpleRouteJson: SimpleRouteJson = {
      bounds: {
        minX: GLOBAL_BOUNDS.x,
        maxX: GLOBAL_BOUNDS.x + GLOBAL_BOUNDS.width,
        minY: GLOBAL_BOUNDS.y,
        maxY: GLOBAL_BOUNDS.y + GLOBAL_BOUNDS.height,
      },
      obstacles: obstacles.map((obs, idx) => ({
        type: "rect" as const,
        layers: ["top"],
        center: {
          x: obs.x + obs.width / 2,
          y: obs.y + obs.height / 2,
        },
        width: obs.width,
        height: obs.height,
        connectedTo: [],
      })),
      connections: [],
      layerCount: 1,
      minTraceWidth: 0.15,
    }

    const newSolver = new EdgeExpansionSolver({
      simpleRouteJson,
      options: {
        minRequiredExpandSpace: minExpandSpace,
      },
    })

    newSolver.setup()
    return newSolver
  }, [obstacles, minExpandSpace])

  const state = solver ? (solver as any).state : null
  const capacityNodes = state?.nodes || []
  const currentRound = state?.currentRound || []
  const currentNodeId = state?.currentNodeId || null

  const generateRandomObstacles = () => {
    const count = Math.floor(Math.random() * 4) + 2
    const newObstacles = []

    for (let i = 0; i < count; i++) {
      const width = Math.random() * 100 + 60
      const height = Math.random() * 80 + 50
      const x =
        Math.random() * (GLOBAL_BOUNDS.width - width - 100) +
        GLOBAL_BOUNDS.x +
        50
      const y =
        Math.random() * (GLOBAL_BOUNDS.height - height - 100) +
        GLOBAL_BOUNDS.y +
        50

      newObstacles.push({ x, y, width, height })
    }

    return newObstacles
  }

  const reset = () => {
    const newObstacles = generateRandomObstacles()
    setObstacles(newObstacles)
    setIteration(0)
    setIsComplete(false)
  }

  useEffect(() => {
    reset()
  }, [])

  const stepIteration = () => {
    if (!solver || isComplete) return

    solver.step()
    setIteration(iteration + 1)

    if (solver.solved) {
      setIsComplete(true)
    }
  }

  const solve = () => {
    if (!solver || isComplete) return

    solver.solve()
    setIsComplete(true)
    setIteration((solver as any).state.iteration)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "24px",
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          padding: "24px",
          width: "100%",
          maxWidth: "1024px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
          Edge Expansion Algorithm
        </h1>

        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <button
            onClick={stepIteration}
            disabled={!solver || isComplete}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor:
                !solver || isComplete ? "#d1d5db" : "#3b82f6",
              color: "white",
              borderRadius: "4px",
              border: "none",
              cursor: !solver || isComplete ? "not-allowed" : "pointer",
            }}
          >
            Step
          </button>

          <button
            onClick={solve}
            disabled={!solver || isComplete}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor:
                !solver || isComplete ? "#d1d5db" : "#10b981",
              color: "white",
              borderRadius: "4px",
              border: "none",
              cursor: !solver || isComplete ? "not-allowed" : "pointer",
            }}
          >
            Solve
          </button>

          <button
            onClick={reset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "#6b7280",
              color: "white",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reset
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="minExpandSpace">Min Expand Space:</label>
            <input
              id="minExpandSpace"
              type="number"
              value={minExpandSpace}
              onChange={(e) => setMinExpandSpace(Number(e.target.value))}
              style={{
                padding: "4px 8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                width: "80px",
              }}
              min="1"
              max="50"
            />
          </div>
        </div>

        <div style={{ marginBottom: "16px", fontSize: "14px", color: "#4b5563" }}>
          <div>Iteration: {iteration}</div>
          <div>Current Round Size: {currentRound.length}</div>
          <div>Current Node: {currentNodeId || "None"}</div>
          <div>Status: {isComplete ? "Complete" : "In Progress"}</div>
        </div>

        <svg
          width={GLOBAL_BOUNDS.width + 100}
          height={GLOBAL_BOUNDS.height + 100}
          style={{ border: "1px solid #d1d5db", backgroundColor: "white" }}
        >
          <rect
            x={GLOBAL_BOUNDS.x}
            y={GLOBAL_BOUNDS.y}
            width={GLOBAL_BOUNDS.width}
            height={GLOBAL_BOUNDS.height}
            fill="none"
            stroke="#666"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          {capacityNodes.map((node: any, idx: number) => {
            // Render all nodes with minimum size for visibility, preserving orientation
            const boardScale = (GLOBAL_BOUNDS.width + GLOBAL_BOUNDS.height) / 2
            const MIN_VISUAL_SIZE = boardScale * 0.001
            
            let visualWidth = node.width
            let visualHeight = node.height
            
            // Preserve orientation for edge nodes
            if (node.nodeType === "edge") {
              if (node.freeDimensions.includes("y-") || node.freeDimensions.includes("y+")) {
                // Horizontal edge
                visualHeight = Math.max(node.height, MIN_VISUAL_SIZE)
              } else if (node.freeDimensions.includes("x-") || node.freeDimensions.includes("x+")) {
                // Vertical edge
                visualWidth = Math.max(node.width, MIN_VISUAL_SIZE)
              }
            } else {
              // Corner nodes
              visualWidth = Math.max(node.width, MIN_VISUAL_SIZE)
              visualHeight = Math.max(node.height, MIN_VISUAL_SIZE)
            }
            
            return (
              <rect
                key={`node-${idx}`}
                x={node.x}
                y={node.y}
                width={visualWidth}
                height={visualHeight}
                fill={
                  currentNodeId === node.id && !node.done
                    ? "#fbbf24"
                    : node.done
                    ? "#60a5fa"
                    : "#93c5fd"
                }
                stroke={currentNodeId === node.id && !node.done ? "#f59e0b" : "#2563eb"}
                strokeWidth={currentNodeId === node.id && !node.done ? "2" : "1"}
                opacity="0.7"
              />
            )
          })}

          {obstacles.map((obs, idx) => (
            <rect
              key={`obs-${idx}`}
              x={obs.x}
              y={obs.y}
              width={obs.width}
              height={obs.height}
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="2"
            />
          ))}
        </svg>

        <div style={{ marginTop: "16px", fontSize: "14px", color: "#4b5563" }}>
          <p>
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                backgroundColor: "#ef4444",
                border: "1px solid #991b1b",
                marginRight: "8px",
              }}
            />
            Red: Obstacles
          </p>
          <p>
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                backgroundColor: "#fbbf24",
                border: "2px solid #f59e0b",
                marginRight: "8px",
              }}
            />
            Yellow/Orange: Currently processing
          </p>
          <p>
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                backgroundColor: "#93c5fd",
                border: "1px solid #2563eb",
                marginRight: "8px",
              }}
            />
            Light Blue: Queued capacity nodes
          </p>
          <p>
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                backgroundColor: "#60a5fa",
                border: "1px solid #2563eb",
                marginRight: "8px",
              }}
            />
            Dark Blue: Completed capacity nodes
          </p>
        </div>
      </div>
    </div>
  )
}

export default EdgeExpansionInteractive

