declare module "@tscircuit/autorouting-dataset-01" {
  const dataset: Record<string, unknown>
  export = dataset
}

declare module "*.json" {
  const value: any
  export default value
}
