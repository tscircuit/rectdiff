import { useMemo } from "react"
import { SolverDebugger3d } from "../../components/SolverDebugger3d"
import { RectDiffPipeline } from "../../lib/RectDiffPipeline"
import srjJson from "../../tests/solver/bugreport50-multi-support-layer-merge/bugreport50-multi-support-layer-merge.json"

const simpleRouteJson =
  srjJson.simpleRouteJson ?? srjJson.simple_route_json ?? srjJson

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
