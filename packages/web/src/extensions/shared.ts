// The modules an extension's page may import by name: the app's own copies of React, StyleX, Astryx,
// and its tokens, and `uraeda/page`. Every `@astryxdesign/core/<path>` resolves to the package's
// index, which exports each component by its subpath's name (R7), except the tokens' module,
// whose variables StyleX's compiled classes read. They load with the first page, so the main chunk
// holds no component it does not draw itself.

/** Gives the shared module a page imports as a specifier, or undefined when it cannot. */
export type SharedModules = (specifier: string) => object | undefined;

let loading: Promise<SharedModules> | undefined;

async function load(): Promise<SharedModules> {
  const [astryx, tokens, stylex, react, compilerRuntime, jsxRuntime, reactDom, page] =
    await Promise.all([
      import("@astryxdesign/core"),
      import("@astryxdesign/core/theme/tokens.stylex"),
      import("@stylexjs/stylex"),
      import("react"),
      import("react/compiler-runtime"),
      import("react/jsx-runtime"),
      import("react-dom"),
      import("./hooks.ts"),
    ]);
  const shared = new Map<string, object>([
    ["@astryxdesign/core", astryx],
    ["@astryxdesign/core/theme/tokens.stylex", tokens],
    ["@stylexjs/stylex", stylex],
    ["react", react],
    ["react-dom", reactDom],
    ["react/compiler-runtime", compilerRuntime],
    ["react/jsx-runtime", jsxRuntime],
    ["uraeda/page", page],
  ]);
  return (specifier) =>
    shared.get(specifier) ?? (specifier.startsWith("@astryxdesign/core/") ? astryx : undefined);
}

/** The shared modules, loaded once: a load that failed is tried again at the next call. */
export function sharedModules(): Promise<SharedModules> {
  loading ??= load().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
