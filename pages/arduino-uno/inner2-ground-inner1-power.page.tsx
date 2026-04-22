import simpleRouteJson from "../../test-assets/arduino-uno-inner2-ground-inner1-power.json"
import { RectDiffPipeline } from "../../lib/RectDiffPipeline"
import { useMemo } from "react"
import { SolverDebugger3d } from "../../components/SolverDebugger3d"

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
