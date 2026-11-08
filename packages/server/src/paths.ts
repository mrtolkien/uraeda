// The one home of where the server finds its plugin, its extensions' documentation, its web UI,
// its StyleX tokens, and its checkout (the distribution decision): no other module builds these
// paths.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Where the server finds what it reads at run time. */
export type Layout = {
  /** The checkout's root, for its `.env` and the binding's freshness check; null in the package. */
  checkout: string | null;
  /**
   * The documentation of the extension API, which sessions are told to read: `docs/extensions.md`
   * of the checkout, or of the package, which ships it.
   */
  docs: string;
  /** `package` from the bundle, `checkout` from the server's sources. */
  kind: "checkout" | "package";
  /** The folder passed to `claude --plugin-dir`: `.claude-plugin/plugin.json` and `skills/uraeda/`. */
  plugin: string;
  /**
   * Astryx's StyleX token file, which extension pages' `@astryxdesign/core/theme/tokens.stylex`
   * imports compile against: from `node_modules` in a checkout, copied to `dist/stylex/` in the
   * package.
   */
  stylexTokens: string;
  /** The built web UI, served as static files. */
  web: string;
};

/** Defined, as true, by the `@uraeda/ui` package's build of the bundle; undefined in the sources. */
declare const URAEDA_PACKAGE: boolean | undefined;

// `typeof`, as the sources never define it: a bare reference would throw.
const PACKAGED = typeof URAEDA_PACKAGE === "boolean" && URAEDA_PACKAGE;

/**
 * The layout of the code calling it: the package's when built with `URAEDA_PACKAGE`, else the
 * checkout's. `moduleUrl` is this module's URL: `<root>/packages/server/src/paths.ts` in a
 * checkout, `<package>/dist/uraeda.mjs` once bundled.
 */
export function layout(packaged: boolean = PACKAGED, moduleUrl: string = import.meta.url): Layout {
  const path = (relative: string) => fileURLToPath(new URL(relative, moduleUrl)).replace(/\/$/, "");
  if (packaged) {
    return {
      checkout: null,
      docs: path("../docs/extensions.md"),
      kind: "package",
      plugin: path("../plugin"),
      stylexTokens: path("./stylex/tokens.stylex.js"),
      web: path("../web"),
    };
  }
  return {
    checkout: path("../../.."),
    docs: path("../../../docs/extensions.md"),
    kind: "checkout",
    plugin: path("../plugin"),
    stylexTokens: path("../node_modules/@astryxdesign/core/dist/theme/tokens.stylex.js"),
    web: path("../../web/dist"),
  };
}

/** Refuses to start without the built web UI, as in a checkout before its build. */
export function requireWeb(web: string): void {
  if (!existsSync(join(web, "index.html"))) {
    throw new Error("the web UI is not built; run vp run --filter uraeda-web build");
  }
}
