import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { AgentEvent } from "./events.ts";

/** A short process, as one that lists an agent's models, gives up after this long. */
export const MODELS_TIMEOUT_MS = 10_000;
/** A short process, sent SIGTERM as it is done with, is killed when it still runs this long after. */
export const MODELS_KILL_AFTER_MS = 5000;
/** A failed process keeps this many lines of stderr. */
const STDERR_LINES = 20;
/** The characters of stderr kept while a process runs, enough for its last lines. */
const STDERR_KEPT = 64_000;

/** What signals each open process's group, until its output closes. */
const groups = new Set<(signal: NodeJS.Signals) => void>();
let ending = false;

/**
 * Sends SIGTERM to every open process's group as the server exits, even on a crash: in groups of
 * their own, they would outlive it.
 */
function endWithServer() {
  if (!ending) {
    ending = true;
    process.once("exit", () => {
      for (const signal of groups) {
        signal("SIGTERM");
      }
    });
  }
}

/** Events pushed by one reader and read in order by one consumer, until it ends. */
export class EventQueue implements AsyncIterable<AgentEvent> {
  #items: Array<AgentEvent> = [];
  #ended = false;
  #wake: (() => void) | undefined;

  push(event: AgentEvent) {
    this.#items.push(event);
    this.#wake?.();
  }

  end() {
    this.#ended = true;
    this.#wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
    for (;;) {
      const event = this.#items.shift();
      if (event !== undefined) {
        yield event;
      } else if (this.#ended) {
        return;
      } else {
        await new Promise<void>((resolve) => (this.#wake = resolve));
        this.#wake = undefined;
      }
    }
  }
}

/** The lines of a byte stream, decoded as UTF-8 across chunks. Empty lines are dropped. */
export async function* lines(chunks: AsyncIterable<Buffer>): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of chunks) {
    rest += decoder.decode(chunk, { stream: true });
    const parts = rest.split("\n");
    rest = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.replace(/\r$/, "");
      if (line !== "") {
        yield line;
      }
    }
  }
  rest += decoder.decode();
  const line = rest.replace(/\r$/, "");
  if (line !== "") {
    yield line;
  }
}

/** An agent's process, as `spawnGrouped` started it. */
export type Child = {
  /** The process: its stdout is the runtime's to read. */
  child: ChildProcessWithoutNullStreams;
  /** The exit event, once stdout and stderr have closed, or the process failed to start. */
  exited: Promise<Extract<AgentEvent, { type: "exit" }>>;
  /** Signals the process's group, or the process alone on Windows, until its output closes. */
  signal(name: NodeJS.Signals): void;
  /** Writes `value` as one JSON line to stdin, dropped once stdin has closed. */
  write(value: unknown): void;
};

/** Ends the process's group with the server, and forgets it once its output closes. */
function track(child: ChildProcessWithoutNullStreams, grouped: boolean) {
  // Until its output closes, a process of the group holds it: the group's ID is not reused.
  let running = child.pid !== undefined;
  const signal = (name: NodeJS.Signals) => {
    if (!running || child.pid === undefined) {
      return;
    }
    try {
      if (grouped) {
        process.kill(-child.pid, name);
      } else {
        child.kill(name);
      }
    } catch {
      // The group is gone.
    }
  };
  groups.add(signal);
  const forget = () => {
    running = false;
    groups.delete(signal);
  };
  child.once("close", forget);
  child.once("error", forget);
  endWithServer();
  return signal;
}

/** The exit event of `child`, started in `cwd`, with its stderr's last lines. */
function exitOf(
  child: ChildProcessWithoutNullStreams,
  cwd: string,
): Promise<Extract<AgentEvent, { type: "exit" }>> {
  // Only its end is kept: a failed process shows its last lines.
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data: string) => {
    stderr = (stderr + data).slice(-STDERR_KEPT);
  });
  return new Promise((resolve) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      // Node says ENOENT for a missing directory as for a missing command.
      if (error.code === "ENOENT" && !existsSync(cwd)) {
        resolve({ code: null, stderr: `The session's directory is gone: ${cwd}`, type: "exit" });
        return;
      }
      resolve({
        code: null,
        stderr: error.message,
        type: "exit",
        ...(error.code === "ENOENT" ? { missing: true } : {}),
      });
    });
    // After stdout and stderr have closed, so nothing printed is lost.
    child.on("close", (code) => {
      const tail = stderr.trimEnd().split("\n").slice(-STDERR_LINES).join("\n");
      resolve({ code, stderr: tail, type: "exit" });
    });
  });
}

/**
 * Starts `command` with `args` in `cwd`, its stdio piped. In a process group of its own, which its
 * signals reach whole: the tools it started end with it. The terminal's Ctrl-C no longer reaches
 * it, so the server ends it as it exits. Windows has no process groups to signal: there, the
 * process alone is.
 */
export function spawnGrouped(command: string, args: Array<string>, cwd: string): Child {
  const grouped = process.platform !== "win32";
  const child = spawn(command, args, { cwd, detached: grouped, stdio: ["pipe", "pipe", "pipe"] });
  const signal = track(child, grouped);
  const exited = exitOf(child, cwd);
  // A process that exited closes stdin: later writes fail here, and are dropped.
  child.stdin.on("error", () => {});
  const write = (value: unknown) => {
    if (child.stdin.writable) {
      child.stdin.write(`${JSON.stringify(value)}\n`);
    }
  };
  return { child, exited, signal, write };
}

/**
 * Ends a short process done with, answered or not: its stdin closes, its group gets SIGTERM, and
 * SIGKILL when it still runs `MODELS_KILL_AFTER_MS` after.
 */
export function endShortProcess({ child, exited, signal }: Child) {
  child.stdin.end();
  signal("SIGTERM");
  const kill = setTimeout(() => signal("SIGKILL"), MODELS_KILL_AFTER_MS);
  kill.unref();
  void exited.then(() => clearTimeout(kill));
}
