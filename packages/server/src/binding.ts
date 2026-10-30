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

/** The checkout's built bindings, and the paths of what they are built from that exist. */
function built(root: string): { bindings: Array<string>; sources: Array<string> } {
  const folder = join(root, "packages/binding");
  const bindings = existsSync(folder)
    ? readdirSync(folder)
        .filter((name) => name.endsWith(".node"))
        .map((name) => join(folder, name))
    : [];
  const sources = SOURCES.map((source) => join(root, source)).filter((path) => existsSync(path));
  return { bindings, sources };
}

/**
 * Whether the checkout's built binding is older than what it is built from, as after a pull that
 * changed the core. Outside a checkout of the repository, with no Rust to compare to, it never is.
 */
function stale(root: string): boolean {
  const { bindings, sources } = built(root);
  if (bindings.length === 0 || sources.length === 0) {
    return false;
  }
  const binding = Math.min(...bindings.map((path) => statSync(path).mtimeMs));
  return Math.max(...sources.map(latest)) > binding;
}

/**
 * Whether the checkout has the Rust a binding is built from, and no binding built, as a new
 * worktree after its install.
 */
function missing(root: string): boolean {
  const { bindings, sources } = built(root);
  return bindings.length === 0 && sources.length > 0;
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
 * Builds the checkout's binding when it is missing, as in a new worktree, or older than the Rust
 * core, before anything loads it: `vp dev`, the tests, and Storybook then run the core as it is,
 * instead of failing to load it or refusing to. `vp run binding:touch` takes the build from Vite
 * Task's cache, or from cargo, then marks it built now. Node cannot reload a binding it loaded, so
 * this runs first, in the configs that load it.
 */
export function freshBinding(
  root: string | null,
  build: (root: string) => void = (root) =>
    execFileSync("vp", ["run", "binding:touch"], { cwd: root, stdio: "inherit" }),
): void {
  if (root === null) {
    return;
  }
  if (missing(root)) {
    process.stderr.write("[uraeda] The native binding is not built: building it…\n");
  } else if (stale(root)) {
    process.stderr.write(
      "[uraeda] The native binding is older than the Rust core: rebuilding it…\n",
    );
  } else {
    return;
  }
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
