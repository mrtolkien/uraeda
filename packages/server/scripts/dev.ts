/**
 * `vp run dev`: `vp dev`, restarted when the code it runs in its own process changes. It builds the
 * binding first, as `vp dev` refuses one older than the Rust. A change to what the binding is built
 * from rebuilds it, then restarts `vp dev`; a change to the server's code only restarts it. Node
 * cannot unload a native addon, and Vite loads the server once, with its config. The page reloads
 * once Vite's server is back, as its client does after a lost connection.
 *
 * A build that fails keeps the running server, on the last binding, and logs why: the next change
 * builds again. Ctrl-C stops both.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { watch } from "node:fs";
import { join, relative, sep } from "node:path";
import { SOURCES } from "../src/binding.ts";
import { layout } from "../src/paths.ts";

/** The repository's root, where `vp dev` runs. */
const ROOT = layout().checkout ?? process.cwd();
/** The server's code, which Vite's process loads once, in its config. */
const SERVER = "packages/server/src";
/** Changes this close together, as an editor's save or a checkout writes them, make one restart. */
const QUIET_MS = 150;

let child: ChildProcess | undefined;
let building = false;
let pending: "build" | "restart" | undefined;
let timer: NodeJS.Timeout | undefined;
let stopping = false;

function log(message: string) {
  process.stdout.write(`\u001b[36m[uraeda dev]\u001b[0m ${message}\n`);
}

/** Whether a changed path, from the root, is one the binding is built from. */
function isSource(path: string) {
  return SOURCES.some((source) => path === source || path.startsWith(source + sep));
}

/** Whether a changed path, from the root, is the server's code, not its tests. */
function isServer(path: string) {
  return path.startsWith(SERVER + sep) && !path.split(sep).includes("__tests__");
}

/** Runs a command at the root, with its output on this terminal, to its exit code. */
function run(command: string, args: Array<string>): Promise<number | null> {
  return new Promise((resolve) => {
    spawn(command, args, { cwd: ROOT, stdio: "inherit" }).once("exit", resolve);
  });
}

/** Starts `vp dev`, which reads this terminal for its shortcuts. */
function start() {
  child = spawn("vp", ["dev"], { cwd: ROOT, stdio: "inherit" });
  child.once("exit", (code) => {
    child = undefined;
    // `vp dev` quit on its own, as with its `q` shortcut: this quits with it.
    if (!stopping) {
      process.exit(code ?? 0);
    }
  });
}

/** The processes a process started, and the ones they started, from `pgrep`. */
function descendants(pid: number): Array<number> {
  let children: Array<number>;
  try {
    children = execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map(Number);
  } catch {
    // `pgrep` exits 1 when it finds none.
    return [];
  }
  return children.flatMap((child) => [child, ...descendants(child)]);
}

/** Signals a process and the processes under it: `vp` passes no signal on to Vite's. */
function signalTree(pid: number, signal: NodeJS.Signals) {
  for (const target of [...descendants(pid), pid]) {
    try {
      process.kill(target, signal);
    } catch {
      // It exited meanwhile.
    }
  }
}

/** Stops `vp dev` and what it runs, to when it has exited and its port is free. */
async function stop() {
  const running = child;
  if (!running?.pid) {
    return;
  }
  stopping = true;
  const exited = new Promise((resolve) => running.once("exit", resolve));
  signalTree(running.pid, "SIGTERM");
  await exited;
  stopping = false;
}

/** Builds the binding, or only restarts, then takes the next change that came in meanwhile. */
async function apply(kind: "build" | "restart") {
  building = true;
  if (kind === "build") {
    log("Building the binding…");
    const code = await run("vp", ["run", "--filter", "uraeda-binding", "build"]);
    if (code !== 0) {
      log("The binding did not build: the server keeps the last one.");
      building = false;
      return next();
    }
  } else {
    log("The server changed: restarting…");
  }
  await stop();
  start();
  building = false;
  return next();
}

function next() {
  const kind = pending;
  pending = undefined;
  if (kind) {
    void apply(kind);
  }
}

/** Queues a change: a build wins over a restart, which the build ends with anyway. */
function changed(kind: "build" | "restart") {
  pending = pending === "build" ? "build" : kind;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!building) {
      next();
    }
  }, QUIET_MS);
}

/** Watches a folder, recursively or not, for changes to the binding's sources or the server. */
function watchFolder(folder: string, recursive: boolean) {
  watch(join(ROOT, folder), { recursive }, (_event, name) => {
    if (!name) {
      return;
    }
    const path = relative(ROOT, join(ROOT, folder, name.toString()));
    if (isSource(path)) {
      changed("build");
    } else if (isServer(path)) {
      changed("restart");
    }
  });
}

watchFolder("crates", true);
watchFolder("skills/uraeda", true);
watchFolder(SERVER, true);
// `Cargo.toml` and `Cargo.lock`: an editor's save replaces a file, which ends a watch of the file.
watchFolder(".", false);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
    if (child?.pid) {
      signalTree(child.pid, signal);
    }
    process.exit(0);
  });
}

// The binding may be missing, or older than the Rust, as after a pull: cargo builds only what changed.
void apply("build");
