import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import bugreport46 from "../test-assets/bugreport46-ac4337-arduino-uno-inner-pours.json"
import type { SimpleRouteJson } from "../lib/types/srj-types"

export const bugreport46ArduinoUnoInnerPoursSrj =
  (bugreport46 as { simple_route_json?: SimpleRouteJson }).simple_route_json ??
  (bugreport46 as SimpleRouteJson)

export default () => {
  const solver = useMemo(
    () =>
      new RectDiffPipeline({
        simpleRouteJson: bugreport46ArduinoUnoInnerPoursSrj,
      }),
    [],
  )

  return (
    <SolverDebugger3d
      solver={solver}
      simpleRouteJson={bugreport46ArduinoUnoInnerPoursSrj}
    />
  )
}
