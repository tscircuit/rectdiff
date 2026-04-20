import { useMemo } from "react"
import { getBounds, getSvgFromGraphicsObject } from "graphics-debug"
import {
  buildRotatedObstacleResolutionStackedGraphic,
  rotatedObstacleResolutionCases,
} from "lib/fixtures/rotatedObstacleResolutionFixture"

export default () => {
  const { graphics } = useMemo(
    () => buildRotatedObstacleResolutionStackedGraphic(),
    [],
  )
  const svg = useMemo(() => {
    const bounds = getBounds(graphics)
    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const svgWidth = 960
    const svgHeight = Math.max(svgWidth, Math.ceil((height / width) * svgWidth))
    return getSvgFromGraphicsObject(graphics, {
      svgWidth,
      svgHeight,
    })
  }, [graphics])

  return (
    <div
      style={{
        padding: 24,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily:
          '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif',
      }}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>
        Rotated Obstacle Resolution Sweep
      </h1>
      <p style={{ margin: "0 0 16px", maxWidth: 720, lineHeight: 1.5 }}>
        A single rotated SRJ obstacle is solved three times while the solver
        grid and rotated-obstacle decomposition step are tightened together. The
        dark red outline is the exact rotated rectangle; the filled red
        staircase is the axis-aligned approximation currently fed into rectdiff.
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#475569" }}>
        Cases:{" "}
        {rotatedObstacleResolutionCases
          .map(
            (caseConfig) =>
              `${caseConfig.name}=${caseConfig.gridOptions.rotatedObstacleGridSize}`,
          )
          .join(", ")}
      </p>
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 16,
          background: "#ffffff",
          padding: 16,
          overflow: "auto",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
