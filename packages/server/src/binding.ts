import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { layout } from "./paths.ts";

type Binding = typeof import("uraeda-binding");

/**
 * What the binding is built from: the core, the binding's crate, and the skill the core embeds. Not
 * the crates' tests, which a build does not read.
 */
export const SOURCES = [
  "crates/core/src",
  "crates/core/build.rs",
  "crates/core/Cargo.toml",
  "crates/binding/src",
  "crates/binding/build.rs",
  "crates/binding/Cargo.toml",
  "skills/uraeda",
  "Cargo.toml",
  "Cargo.lock",
];

/** The latest modification time of a file, or of the files under a folder. */
function latest(path: string): number {
  const stat = statSync(path);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }
  return Math.max(stat.mtimeMs, ...readdirSync(path).map((name) => latest(join(path, name))));
}

/**
 * Whether the checkout's built binding is older than what it is built from, as after a pull that
 * changed the core. Outside a checkout of the repository, with no Rust to compare to, it never is.
 */
function stale(root: string): boolean {
  const folder = join(root, "packages/binding");
  const built = existsSync(folder)
    ? readdirSync(folder).filter((name) => name.endsWith(".node"))
    : [];
  const sources = SOURCES.map((source) => join(root, source)).filter((path) => existsSync(path));
  if (built.length === 0 || sources.length === 0) {
    return false;
  }
  const binding = Math.min(...built.map((name) => statSync(join(folder, name)).mtimeMs));
  return Math.max(...sources.map(latest)) > binding;
}

/**
 * Refuses a binding older than what it is built from: the server would read the files with the old
 * core, and the UI would read what it no longer writes.
 */
export function checkBinding(root: string): void {
  if (stale(root)) {
    throw new Error(
      "the native binding is older than the Rust core; run vp run --filter uraeda-binding build",
    );
  }
}

/**
 * Rebuilds the checkout's binding when it is older than the Rust core, before anything loads it:
 * `vp dev` and the tests then run the core as it is, instead of refusing to. `vp run binding:touch`
 * takes the build from Vite Task's cache, or from cargo, then marks it built now. Node cannot
 * reload a binding it loaded, so this runs first, in the configs of the packages that load it.
 */
export function freshBinding(
  root: string | null,
  build: (root: string) => void = (root) =>
    execFileSync("vp", ["run", "binding:touch"], { cwd: root, stdio: "inherit" }),
): void {
  if (root === null || !stale(root)) {
    return;
  }
  process.stderr.write("[uraeda] The native binding is older than the Rust core: rebuilding it…\n");
  build(root);
  checkBinding(root);
}

/**
 * Loads the native binding. In a checkout, it refuses a binding older than the Rust core, and says
 * how to build a missing one. In the package, which has no Rust to build from, a missing binding
 * shows the loader's own error, which names the platform package to install.
 */
export async function loadBinding(
  load: () => Promise<Binding> = () => import("uraeda-binding"),
  checkout: string | null = layout().checkout,
): Promise<Binding> {
  if (checkout === null) {
    return load();
  }
  checkBinding(checkout);
  try {
    return await load();
  } catch {
    throw new Error("the native binding is not built; run vp run ready");
  }
}
