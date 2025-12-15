import { useState, useMemo } from "react"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { EdgeExpansionSolver } from "../lib/solvers/EdgeExpansionSolver"
import type { SimpleRouteJson } from "../lib/types/srj-types"
import { SolverDebugger3d } from "../components/SolverDebugger3d"
import { EDGE_EXPANSION_CONFIG } from "../edge-expansion.config"

const generateRandomObstacles = (seed: number): SimpleRouteJson => {
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  const count = Math.floor(rng() * 4) + 2
  const obstacles = []

  for (let i = 0; i < count; i++) {
    const width = rng() * 10 + 6
    const height = rng() * 8 + 5
    const x = rng() * (70 - width - 10) + 5 + 5
    const y = rng() * (50 - height - 10) + 5 + 5

    obstacles.push({
      type: "rect" as const,
      layers: ["top"],
      center: { x: x + width / 2, y: y + height / 2 },
      width,
      height,
      connectedTo: [],
    })
  }

  return {
    bounds: {
      minX: 5,
      maxX: 75,
      minY: 5,
      maxY: 55,
    },
    obstacles,
    connections: [],
    layerCount: 1,
    minTraceWidth: 0.15,
  }
}

export default () => {
  const [seed, setSeed] = useState(42)

  const solver = useMemo(() => {
    const s = new EdgeExpansionSolver({
      simpleRouteJson: generateRandomObstacles(seed),
      options: {
        minRequiredExpandSpace: EDGE_EXPANSION_CONFIG.MIN_REQUIRED_EXPAND_SPACE,
      },
    })
    s.setup() // Initialize the solver so initial nodes are visible
    return s
  }, [seed])

  return (
    <div>
      <div style={{ padding: "10px", background: "#f0f0f0" }}>
        <button
          onClick={() => setSeed((s) => s + 1)}
          style={{
            padding: "8px 16px",
            marginRight: "10px",
            cursor: "pointer",
          }}
        >
          Generate New Random Obstacles
        </button>
        <span>Seed: {seed}</span>
      </div>
      <SolverDebugger3d solver={solver} />
    </div>
  )
}

