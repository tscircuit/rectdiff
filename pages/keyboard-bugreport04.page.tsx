import simpleRouteJson from "../test-assets/bugreport04-aa1d41.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(
    () =>
      new RectDiffPipeline({
        simpleRouteJson: simpleRouteJson.simple_route_json,
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
