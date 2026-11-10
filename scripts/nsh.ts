/**
 * `node scripts/nsh.ts <command> [args…]`: runs Native Shell's CLI, `nsh`, on the app in `app/`,
 * as the `app:*` tasks of `vite.tasks.ts` do (see `specs/decisions/toolchain.md`).
 *
 * `nsh` builds the app's runners in a Cargo workspace it generates, `app/.nsh/rust`, with a
 * lockfile of its own, which Cargo would fill with the newest version of every crate: a build
 * would then depend on the day it first ran. So that lockfile starts as the repository's
 * `Cargo.lock`, and the runners build in the repository's `target/`: Cargo keeps the versions the
 * repository pins, and builds each crate once for both.
 */
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { constants } from "node:os";
import { dirname, join } from "node:path";

/** When a file was last written, and 0 when there is none. */
function written(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Copies the repository's lockfile over the generated workspace's when that one is missing, or
 * older: a version pinned since then reaches the runners. Cargo then drops the crates the runners
 * do not use, and adds the ones only they do. Returns whether it copied.
 */
export function seedLock(pinned: string, generated: string): boolean {
  if (written(generated) >= written(pinned)) {
    return false;
  }
  mkdirSync(dirname(generated), { recursive: true });
  copyFileSync(pinned, generated);
  return true;
}

/**
 * `nsh`'s arguments, where a development session, `run` or `dev`, takes a free port unless one is
 * asked for: several checkouts then run the app at once, where NSH's fixed default let only one.
 */
export function withFreePort(args: Array<string>): Array<string> {
  const session = args[0] === "run" || args[0] === "dev";
  const asked = args.some((arg) => arg === "--port" || arg.startsWith("--port="));
  return session && !asked ? [...args, "--port", "0"] : args;
}

/** Runs `nsh` in `app/`, and exits as it does. */
async function main() {
  const root = join(import.meta.dirname, "..");
  const app = join(root, "app");
  seedLock(join(root, "Cargo.lock"), join(app, ".nsh/rust/Cargo.lock"));
  const child = spawn("nsh", withFreePort(process.argv.slice(2)), {
    cwd: app,
    env: {
      ...process.env,
      // Absolute: `nsh` runs Cargo from the crates' folders too.
      CARGO_TARGET_DIR: join(root, "target"),
      // Its locks and downloads, kept out of the machine's cache folder.
      NSH_CACHE: join(root, "target/nsh"),
    },
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => child.kill(signal));
  }
  const [code, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve) => {
    child.once("exit", (code, signal) => resolve([code, signal]));
    child.once("error", (error) => {
      process.stderr.write(`[uraeda] nsh: ${error.message}: run it in the dev shell\n`);
      resolve([127, null]);
    });
  });
  process.exit(code ?? 128 + (signal ? constants.signals[signal] : 0));
}

if (import.meta.main) {
  await main();
}
