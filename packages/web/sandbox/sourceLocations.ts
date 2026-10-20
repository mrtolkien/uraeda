// The sandbox's source locations: code-inspector's transform writes, on each element of the UI's
// components, a `data-insp-path` attribute naming the file, line, and column it is written at,
// which a pick copies. Only the sandbox's Vite config loads it, and only its dev server applies it,
// never a build.
import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { transformCode } from "@code-inspector/core";
import type { Plugin } from "vite-plus";

/** The UI's component files, by their path without a query. */
const COMPONENT = /\.[jt]sx$/;

/** The root of the git checkout holding `folder`, else `folder` itself. */
function checkoutOf(folder: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: folder,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return folder;
  }
}

/**
 * code-inspector's transform alone, in a plugin of our own: its Vite plugin always injects its
 * client, an overlay and a server's console, into the page (R6). Paths are from the root of the
 * checkout holding Vite's root, found as the config resolves: code-inspector's own relative paths
 * are from the checkout of the process's working folder, found as it is imported. It goes first,
 * before the UI's transforms: StyleX adds lines to a file, which would move every location after
 * them (R7).
 */
export function sourceLocations(): Plugin {
  let checkout = "";
  return {
    apply: "serve",
    configResolved(config) {
      checkout = checkoutOf(config.root);
    },
    enforce: "pre",
    name: "uraeda-source-locations",
    async transform(code, id) {
      const [path] = id.split("?", 1);
      if (!COMPONENT.test(path) || path.includes("/node_modules/")) {
        return null;
      }
      const marked = await transformCode({
        content: code,
        escapeTags: [],
        filePath: path,
        fileType: "jsx",
        pathType: "absolute",
      });
      // Each location is the file's absolute path, quoted and followed by its line: made relative,
      // and nothing else in the code is touched.
      const located = marked.replaceAll(`"${path}:`, `"${relative(checkout, path)}:`);
      // Each attribute is added on its tag's own line: lines stay where the file has them, and the
      // dev tools' columns move only after an attribute, which needs no sourcemap.
      return { code: located, map: null };
    },
  };
}
