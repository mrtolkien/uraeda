/**
 * `node scripts/test-run.ts [--lock <name> --slots <n>] <command> [args…]`: runs a test command, as
 * the test tasks of `vite.tasks.ts` do (see `specs/decisions/toolchain.md`).
 *
 * The command runs with a temporary folder of its own, `TMPDIR`, removed when it ends, passed or
 * failed: a test that forgets its folders, or a run killed before its cleanup, leaves nothing in
 * the machine's. A run killed with this script too leaves its folder, which the next run removes.
 *
 * With `--lock`, at most `--slots` runs of that name execute at once on the machine, across every
 * checkout: the others wait, and say so. Several worktrees running their browser tests at once
 * slowed them all past their timeouts.
 */
import { spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { constants, homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** The prefix of a run's folder, followed by the pid of the script that made it. */
const RUN_PREFIX = "uraeda-run-";

/** How often a waiting run checks the slots again. */
const POLL_MS = 1000;

/** A lock file this old that holds no owner yet was left by a run killed while writing it. */
const UNWRITTEN_MS = 10_000;

/** Whether a process runs: one of another user is, though it cannot be signalled. */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Removes the run folders in `parent` whose script no longer runs. */
export function sweep(parent: string): Array<string> {
  return readdirSync(parent).filter((name) => {
    const pid = new RegExp(`^${RUN_PREFIX}(\\d+)-`).exec(name)?.[1];
    if (pid === undefined || alive(Number(pid))) {
      return false;
    }
    // A force-killed wrapper's guard may still be stopping its command before cleanup.
    try {
      const guard = Number(readFileSync(join(parent, name, ".guard-pid"), "utf8"));
      if (guard > 0 && alive(guard)) {
        return false;
      }
    } catch {
      // An older run had no guard, or its guard already removed the folder.
    }
    // Another run may be removing it too, or its command still writing into it: the next run's
    // sweep gets it.
    try {
      rmSync(join(parent, name), { force: true, maxRetries: 3, recursive: true, retryDelay: 50 });
    } catch {
      return false;
    }
    return true;
  });
}

/** A new run folder in `parent`, named after this process. */
export function runFolder(parent: string): string {
  return mkdtempSync(join(parent, `${RUN_PREFIX}${process.pid}-`));
}

/** Signals the command and its descendants, which share the process group it starts. */
function signalGroup(pid: number | undefined, signal: NodeJS.Signals) {
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
      throw error;
    }
  }
}

/**
 * Runs in a separate Node process. IPC disconnects even if Vite Task force-kills the wrapper,
 * when no signal handler can run. Its source and signalGroup's are passed to the guard.
 */
function guardRun(pid: number, folder: string) {
  const stop = async () => {
    signalGroup(pid, "SIGKILL");
    const { rmSync } = await import("node:fs");
    rmSync(folder, { force: true, maxRetries: 3, recursive: true, retryDelay: 50 });
    process.exit(0);
  };
  process.on("disconnect", () => void stop());
  if (!process.connected) {
    void stop();
  }
}

/** Who holds a slot: the script's process and the folder it was started from. */
type Owner = { cwd: string; pid: number };

/** The owner of a slot's file, or null when it was left by a process that ended. */
function owner(file: string): Owner | null {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    // Released meanwhile: free.
    return null;
  }
  try {
    const found = JSON.parse(text) as Owner;
    return alive(found.pid) ? found : null;
  } catch {
    // Being written, unless it was never finished.
    const young = Date.now() - statSync(file, { throwIfNoEntry: false })!.mtimeMs < UNWRITTEN_MS;
    return young ? { cwd: "?", pid: 0 } : null;
  }
}

/** Takes a free slot of `name`, or one whose owner ended; null when all are held. */
function take(dir: string, name: string, slots: number): string | Array<Owner> {
  const owners: Array<Owner> = [];
  for (let slot = 0; slot < slots; slot++) {
    const file = join(dir, `${name}-${slot}.lock`);
    try {
      writeFileSync(file, JSON.stringify({ cwd: process.cwd(), pid: process.pid }), { flag: "wx" });
      return file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    const held = owner(file);
    if (held) {
      owners.push(held);
      continue;
    }
    // Left by a run that ended: two runs freeing it at once may both run, which only costs time.
    rmSync(file, { force: true });
    slot--;
  }
  return owners;
}

/**
 * Takes one of the `slots` slots of `name` in `dir`, waiting while all are held, and returns its
 * release. `wait` is called between two tries.
 */
export async function acquire(
  dir: string,
  name: string,
  slots: number,
  wait: () => Promise<unknown> = () => delay(POLL_MS),
): Promise<() => void> {
  mkdirSync(dir, { recursive: true });
  let said = false;
  for (;;) {
    const taken = take(dir, name, slots);
    if (typeof taken === "string") {
      return () => {
        if (owner(taken)?.pid === process.pid) {
          rmSync(taken, { force: true });
        }
      };
    }
    if (!said) {
      said = true;
      const where = [...new Set(taken.map(({ cwd }) => cwd))].join(", ");
      process.stderr.write(
        `[uraeda] Waiting for ${slots === 1 ? "another run" : `${slots} other runs`} of the ${name} tests to finish, in ${where}…\n`,
      );
    }
    await wait();
  }
}

/** Where the machine's slots are: the user's cache, the same for every checkout. */
function lockFolder(): string {
  return join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "uraeda", "locks");
}

/** The options before the command, and the command. */
function parse(args: Array<string>) {
  let lock: string | undefined;
  let slots = 1;
  while (args[0]?.startsWith("--")) {
    const [option, value] = args.splice(0, 2);
    if (option === "--lock") {
      lock = value;
    } else if (option === "--slots") {
      slots = Number(value);
    } else {
      throw new Error(`test-run: unknown option ${option}`);
    }
  }
  if (!args.length || !(slots >= 1)) {
    throw new Error(
      "usage: node scripts/test-run.ts [--lock <name> --slots <n>] <command> [args…]",
    );
  }
  return { command: args, lock, slots };
}

async function main() {
  const { command, lock, slots } = parse(process.argv.slice(2));
  const release = lock ? await acquire(lockFolder(), lock, slots) : () => {};
  const parent = tmpdir();
  sweep(parent);
  const folder = runFolder(parent);
  const child = spawn(command[0]!, command.slice(1), {
    // Vite Task can cancel this wrapper when another check fails. A separate process group
    // lets cancellation reach the actual runner behind `vp`, not just that launcher.
    detached: true,
    env: { ...process.env, TEMP: folder, TMP: folder, TMPDIR: folder },
    stdio: "inherit",
  });
  if (child.pid !== undefined) {
    const guard = spawn(
      process.execPath,
      [
        "-e",
        `const signalGroup = ${signalGroup.toString()}; (${guardRun.toString()})(${child.pid}, ${JSON.stringify(folder)})`,
      ],
      {
        detached: true,
        stdio: ["ignore", "ignore", "inherit", "ipc"],
      },
    );
    writeFileSync(join(folder, ".guard-pid"), String(guard.pid));
  }
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => signalGroup(child.pid, signal));
  }
  const [code, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve) => {
    child.once("exit", (code, signal) => resolve([code, signal]));
    child.once("error", (error) => {
      process.stderr.write(`[uraeda] ${command[0]}: ${error.message}\n`);
      resolve([127, null]);
    });
  });
  // A launcher can exit before its runner does, especially during cancellation. No process in
  // its group may keep writing into a folder this run or the next run's sweep removes.
  signalGroup(child.pid, "SIGKILL");
  try {
    rmSync(folder, { force: true, maxRetries: 3, recursive: true, retryDelay: 50 });
  } finally {
    release();
  }
  process.exit(code ?? 128 + (signal ? constants.signals[signal] : 0));
}

if (import.meta.main) {
  await main();
}
