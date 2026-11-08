// The page's module runner: each compiled file of an extension's page bundle becomes a fresh
// function, its relative imports resolved against the bundle's files by the loader's rule, its
// bare imports only the shared modules. The same compiled form the server runs: one module runner,
// and no module cache that keeps an old version.
import type { SharedModules } from "./shared.ts";

/** An extension's page, as `GET /extensions/<name>/page` gives it. */
export type PageBundle = {
  css: string;
  entry: string;
  modules: Record<string, string>;
  version: number;
};

type ModuleFunction = (load: (specifier: string) => unknown, exports: object) => void;

/** The endings a relative import without one is tried with, in order, as the loader's. */
const ENDINGS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/** The path `specifier` names from the file `from`, `/` between its parts, or null outside. */
function joined(from: string, specifier: string): string | null {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

/** The file of the bundle the relative import `specifier` of `from` names. */
function resolveFile(files: ReadonlySet<string>, from: string, specifier: string): string {
  const base = joined(from, specifier);
  const candidates =
    base === null ? [] : /\.tsx?$/.test(specifier) ? [base] : ENDINGS.map((end) => base + end);
  const found = candidates.find((candidate) => files.has(candidate));
  if (found === undefined) {
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
  const files = new Set(Object.keys(bundle.modules));
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
        return load(resolveFile(files, file, specifier));
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
