import simpleRouteJson from "../test-assets/board-with-cutout.json"
import { RectDiffPipeline } from "../lib/RectDiffPipeline"
import { useMemo } from "react"
import { SolverDebugger3d } from "../components/SolverDebugger3d"

export default () => {
  const solver = useMemo(() => new RectDiffPipeline({ simpleRouteJson }), [])

  return <SolverDebugger3d solver={solver} simpleRouteJson={simpleRouteJson} />
}
