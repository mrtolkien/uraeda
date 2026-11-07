// One Storybook process of the preview runner: started in a process group of its own, its output's
// last lines kept, its group recorded while it runs, and killed whole.
import { type ChildProcess, spawn } from "node:child_process";
import { endWithServer, type GroupRecorder, groups, keepLines, signalGroup } from "./process.ts";

/** How long a stopped Storybook has to exit before it is killed. */
export const KILL_MS = 5000;

/** One started process: its port, its last lines of output, and a promise of its end. */
export type Run = {
  child: ChildProcess;
  closed: Promise<void>;
  lines: Array<string>;
  port: number;
  running: boolean;
};

/**
 * Starts `command`, its `{port}` replaced, in `cwd`, under the base path `base`; `ended` is called
 * once, with the run and why it ended, after its output closed or it failed to start.
 */
export function startRun(options: {
  base: string;
  command: string;
  cwd: string;
  ended: (run: Run, why: string) => void;
  port: number;
  record: GroupRecorder | undefined;
}): Run {
  const { base, command, cwd, port } = options;
  // A process group of its own, which its signals reach whole: Storybook's own children end
  // with it.
  const child = spawn("sh", ["-c", command.replaceAll("{port}", String(port))], {
    cwd,
    detached: true,
    env: { ...process.env, URAEDA_PREVIEW_BASE: base },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return watch(child, port, options.record, options.ended);
}

/** Watches a started process: its output, its group, and its end. */
function watch(
  child: ChildProcess,
  port: number,
  record: GroupRecorder | undefined,
  onEnd: (run: Run, why: string) => void,
): Run {
  let close!: () => void;
  const run: Run = {
    child,
    closed: new Promise((resolve) => (close = resolve)),
    lines: [],
    port,
    running: child.pid !== undefined,
  };
  if (child.pid !== undefined) {
    groups.add(child.pid);
    endWithServer();
    record?.add(child.pid);
  }
  keepLines(child.stdout, run.lines);
  keepLines(child.stderr, run.lines);
  // What the command started may outlive it, and keep its output open: its whole group goes
  // as soon as it exits, so its output closes, and its end follows at once.
  const stopGroup = () => {
    run.running = false;
    if (child.pid !== undefined && groups.delete(child.pid)) {
      signalGroup(child.pid, "SIGKILL");
      record?.remove(child.pid);
    }
  };
  child.once("exit", stopGroup);
  let done = false;
  const ended = (why: string) => {
    if (done) {
      return;
    }
    done = true;
    stopGroup();
    close();
    onEnd(run, why);
  };
  child.once("error", (error) => {
    run.lines.push(error.message);
    ended(error.message);
  });
  child.once("close", (code, signal) => {
    ended(
      signal ? `The command was stopped by ${signal}.` : `The command exited with code ${code}.`,
    );
  });
  return run;
}

/** Sends SIGTERM to the process's group, then SIGKILL after 5 seconds; resolves once it ended. */
export function killRun(run: Run): Promise<void> {
  const pid = run.child.pid;
  if (!run.running || pid === undefined) {
    return run.closed;
  }
  signalGroup(pid, "SIGTERM");
  const timer = setTimeout(() => signalGroup(pid, "SIGKILL"), KILL_MS);
  return run.closed.then(() => clearTimeout(timer));
}
