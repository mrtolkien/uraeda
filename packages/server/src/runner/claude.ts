import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Adapter, AgentProcess, Capabilities, OpenOptions } from "./adapter.ts";
import { allowRule, type Blocks, lines, parseLine } from "./claude-events.ts";
import type { AgentEvent, Denial } from "./events.ts";

/** The plugin folder around the server's copy of the skill, passed to `--plugin-dir`. */
export const PLUGIN_DIR = fileURLToPath(new URL("../../plugin", import.meta.url));

/** A failed process keeps this many lines of stderr. */
const STDERR_LINES = 20;
/** The characters of stderr kept while a process runs, enough for its last lines. */
const STDERR_KEPT = 64_000;
/** `claude --version` gives up after this long. */
const VERSION_TIMEOUT_MS = 5000;

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

/** The arguments of a session's process: print mode, stream-json both ways, `auto` mode, and the skill. */
export function claudeArgs(options: OpenOptions, pluginDir: string): Array<string> {
  return [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "auto",
    "--plugin-dir",
    pluginDir,
    options.resume ? "--resume" : "--session-id",
    options.nativeId,
    ...(options.allowed === undefined ? [] : ["--allowedTools", options.allowed]),
  ];
}

/** Events pushed by one reader and read in order by one consumer, until it ends. */
class EventQueue implements AsyncIterable<AgentEvent> {
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

export type ClaudeAdapterOptions = {
  /** The command to run, `claude` from the `PATH` by default. */
  command?: string;
  /** Claude Code's configuration folder, where it keeps its transcripts. */
  configDir?: string;
  /** The plugin folder that holds the Uraeda skill, `PLUGIN_DIR` in the server. */
  pluginDir: string;
};

/**
 * Claude Code, run through its installed `claude` command, in print mode, its stdin kept open for
 * the session's messages.
 */
export class ClaudeAdapter implements Adapter {
  readonly kind = "claude";
  readonly name = "Claude Code";
  /** Taking back is `cancel_async_message`, which `validate-claude.ts` checks (R5). */
  readonly capabilities: Capabilities = {
    approvals: false,
    queue: true,
    steer: true,
    subagents: true,
    takeBack: true,
  };
  #command: string;
  #configDir: string;
  #pluginDir: string;

  constructor({
    command = "claude",
    configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
    pluginDir,
  }: ClaudeAdapterOptions) {
    this.#command = command;
    this.#configDir = configDir;
    this.#pluginDir = pluginDir;
  }

  version(): Promise<string | undefined> {
    return new Promise((resolve) => {
      execFile(
        this.#command,
        ["--version"],
        { encoding: "utf8", timeout: VERSION_TIMEOUT_MS },
        (error, stdout) => {
          const first = stdout.split("\n")[0]?.trim();
          resolve(error || !first ? undefined : first);
        },
      );
    });
  }

  /** Looks for `<configDir>/projects/*\/<id>.jsonl`, without reading any file. */
  hasSession(nativeId: string): boolean {
    const projects = join(this.#configDir, "projects");
    let folders: Array<string>;
    try {
      folders = readdirSync(projects);
    } catch {
      return false;
    }
    return folders.some((folder) => existsSync(join(projects, folder, `${nativeId}.jsonl`)));
  }

  allowRule(denial: Denial): string | undefined {
    return allowRule(denial);
  }

  // oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the process's signals, exit, and output in helpers
  open(options: OpenOptions): AgentProcess {
    // In a process group of its own, which its signals reach whole: the tools it started end with
    // it. The terminal's Ctrl-C no longer reaches it, so the server ends it as it exits. Windows
    // has no process groups to signal: there, the process alone is.
    const grouped = process.platform !== "win32";
    const child = spawn(this.#command, claudeArgs(options, this.#pluginDir), {
      cwd: options.cwd,
      detached: grouped,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
    // Only its end is kept: a failed process shows its last lines.
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data: string) => {
      stderr = (stderr + data).slice(-STDERR_KEPT);
    });
    // A process that exited closes stdin: later writes fail here, and are dropped.
    child.stdin.on("error", () => {});
    const exited = new Promise<AgentEvent>((resolve) => {
      child.on("error", (error: NodeJS.ErrnoException) => {
        // Node says ENOENT for a missing directory as for a missing command.
        if (error.code === "ENOENT" && !existsSync(options.cwd)) {
          resolve({
            code: null,
            stderr: `The session's directory is gone: ${options.cwd}`,
            type: "exit",
          });
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

    // Stdout is read as it comes, whether or not the events are: Claude Code loses its last lines
    // when they are read slowly.
    const events = new EventQueue();
    const tasks = new Map<string, string>();
    const blocks: Blocks = new Map();
    void (async () => {
      try {
        for await (const line of lines(child.stdout)) {
          for (const event of parseLine(line, options.cwd, tasks, blocks)) {
            events.push(event);
          }
        }
      } catch {
        // A process that failed to start has no output.
      }
      events.push(await exited);
      events.end();
    })();

    const write = (value: unknown) => {
      if (child.stdin.writable) {
        child.stdin.write(`${JSON.stringify(value)}\n`);
      }
    };
    const control = (request: Record<string, unknown>) =>
      write({ request, request_id: randomUUID(), type: "control_request" });

    return {
      close: () => {
        child.stdin.end();
      },
      events,
      interrupt: () => control({ subtype: "interrupt" }),
      kill: signal,
      send: ({ id, text, when }) => {
        write({
          message: { content: text, role: "user" },
          priority: when === "steer" ? "next" : "later",
          type: "user",
          uuid: id,
        });
      },
      takeBack: (id) => control({ message_uuid: id, subtype: "cancel_async_message" }),
    };
  }
}
