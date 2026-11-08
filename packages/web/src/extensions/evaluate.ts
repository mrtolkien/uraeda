// The page's module runner: each compiled file of an extension's page bundle becomes a fresh
// function, its relative imports the files the server's loader resolved them to, its bare imports
// only the shared modules. The same compiled form the server runs: one module runner,
// and no module cache that keeps an old version.
import type { SharedModules } from "./shared.ts";

/** An extension's page, as `GET /extensions/<name>/page` gives it. */
export type PageBundle = {
  css: string;
  entry: string;
  /** The file each relative import of each file names, by the loader's rule. */
  imports: Record<string, Record<string, string>>;
  modules: Record<string, string>;
  version: number;
};

type ModuleFunction = (load: (specifier: string) => unknown, exports: object) => void;

/** The file of the bundle the relative import `specifier` of `from` names, as the server resolved it. */
function resolveFile(bundle: PageBundle, from: string, specifier: string): string {
  const found = bundle.imports[from]?.[specifier];
  if (found === undefined || !Object.hasOwn(bundle.modules, found)) {
    throw new Error(`${from}: "${specifier}" is not a file of the page`);
  }
  return found;
}

/**
 * The activation of `bundle`: its modules run, each once, from its entry, and its entry's default
 * export, which the caller calls with its page API. Its bare imports are the shared modules only.
 * Throws what a module threw, or why an import cannot be made.
 */
export function pageActivation(
  bundle: PageBundle,
  sharedModule: SharedModules,
): (api: object) => void {
  const loaded = new Map<string, object>();
  const load = (file: string): object => {
    const done = loaded.get(file);
    if (done) {
      return done;
    }
    const exports = {};
    loaded.set(file, exports);
    // The page has no CSP: its code is the owner's, trusted like Uraeda's own.
    const run = new Function("__import", "__exports", bundle.modules[file]) as ModuleFunction;
    run((specifier) => {
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        return load(resolveFile(bundle, file, specifier));
      }
      const shared = sharedModule(specifier);
      if (shared === undefined) {
        throw new Error(
          `${file}: "${specifier}" cannot be imported: a page imports only React, StyleX, Astryx, uraeda/page, and its own files`,
        );
      }
      return shared;
    }, exports);
    return exports;
  };
  const activate = (load(bundle.entry) as { default?: unknown }).default;
  if (typeof activate !== "function") {
    throw new Error(`${bundle.entry} does not export a default function`);
  }
  return (api) => {
    const result: unknown = activate(api);
    if (typeof (result as { then?: unknown } | null)?.then === "function") {
      Promise.resolve(result).catch(() => undefined);
      throw new Error(
        "activation must be synchronous: start async work from a callback, not while loading",
      );
    }
  };
}
