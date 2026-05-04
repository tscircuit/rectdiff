/**
 * Resolves the installed Pipeline 4 source module for benchmarking.
 * The worker imports this file directly instead of going through package exports.
 */
export const getAutorouterPipeline4ModulePath = () =>
  new URL(
    "../autorouter-pipelines/AutoroutingPipeline4_TinyHypergraph/AutoroutingPipelineSolver4_TinyHypergraph.ts",
    import.meta.resolve("@tscircuit/capacity-autorouter"),
  ).href
