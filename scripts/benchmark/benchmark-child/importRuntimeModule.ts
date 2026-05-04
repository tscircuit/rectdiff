/**
 * Imports a runtime-resolved module path.
 * This keeps the benchmark loader on a runtime-only import path.
 */
export const importRuntimeModule = (modulePath: string) =>
  new Function("modulePath", "return import(modulePath)")(
    modulePath,
  ) as Promise<unknown>
