import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import bugreport49 from "../test-assets/bugreport49-634662.json"

const simpleRouteJson = bugreport49.simple_route_json ?? bugreport49

export default () => {
  const solver = useMemo(
    () =>
      new RectDiffPipeline({
        simpleRouteJson,
      }),
    [],
  )

  return <SolverDebugger3d solver={solver} simpleRouteJson={simpleRouteJson} />
}
