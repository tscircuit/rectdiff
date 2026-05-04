/**
 * Imports a runtime-resolved module path.
 * This bypasses Bun's static analyzer for package-internal source paths.
 */
export const importRuntimeModule = (modulePath: string) =>
  new Function("modulePath", "return import(modulePath)")(
    modulePath,
  ) as Promise<unknown>
