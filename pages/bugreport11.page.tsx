import simpleRouteJson from "../test-assets/bugreport11-b2de3c.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(
    () =>
      new RectDiffPipeline({
        simpleRouteJson: simpleRouteJson.simple_route_json,
        obstacleClearance: 0.015
      }),
    [],
  )

  return (
    <SolverDebugger3d
      solver={solver}
      simpleRouteJson={simpleRouteJson.simple_route_json}
    />
  )
}
