/**
 * `vp run --filter @uraeda/ui build`: builds the `@uraeda/ui` package from the other packages' outputs. The
 * server bundled into `dist/uraeda.mjs` by `vp pack`, the loader napi-rs generated copied unchanged
 * as `dist/binding.js`, the built web UI as `web/`, and the plugin as `plugin/`, with a copy of the
 * skill its symlink points to: npm leaves symlinked folders out of a package. The extension API's
 * documentation goes to `docs/`, and Astryx's StyleX token file, which extension pages compile
 * against, to `dist/stylex/`: the package has no `node_modules` of its own to find it in.
 *
 * It fails when the web UI is not built.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { layout } from "../../server/src/paths.ts";

/** `packages/uraeda`. */
const PACKAGE = resolve(import.meta.dirname, "..");
/** Where the checkout keeps the web UI and the plugin. */
const checkout = layout(false);
/** Where the bundle finds them once packaged. */
const packaged = layout(true, pathToFileURL(join(PACKAGE, "dist/uraeda.mjs")).href);

/** Copies a file or a folder, following symlinks: `cpSync` keeps a symlink found inside a folder. */
function copy(from: string, to: string) {
  if (!statSync(from).isDirectory()) {
    copyFileSync(from, to);
    return;
  }
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    copy(join(from, name), join(to, name));
  }
}

if (!existsSync(join(checkout.web, "index.html"))) {
  process.stderr.write("uraeda: the web UI is not built; run vp run --filter uraeda-web build\n");
  process.exit(1);
}

execFileSync("vp", ["pack"], { cwd: PACKAGE, stdio: "inherit" });
copyFileSync(join(PACKAGE, "../binding/index.js"), join(PACKAGE, "dist/binding.js"));
for (const [from, to] of [
  [checkout.web, packaged.web],
  [checkout.plugin, packaged.plugin],
  [checkout.docs, packaged.docs],
  [checkout.stylexTokens, packaged.stylexTokens],
]) {
  rmSync(to, { force: true, recursive: true });
  mkdirSync(dirname(to), { recursive: true });
  copy(from, to);
}
