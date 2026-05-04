declare module "*.json" {
  const value: any
  export default value
}

declare module "@tscircuit/autorouting-dataset-01" {
  import type { SimpleRouteJson } from "./lib/types/srj-types"

  const dataset: Record<string, SimpleRouteJson>
  export = dataset
}
