/**
 * Resolves the published capacity-autorouter dist entry for benchmarking.
 * The benchmark relies on the bundled runtime export instead of package-
 * internal source paths.
 */
export const getAutorouterPipeline4ModulePath = () =>
  import.meta.resolve("@tscircuit/capacity-autorouter")
