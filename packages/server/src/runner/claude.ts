import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Adapter, AgentProcess, Capabilities, OpenOptions } from "./adapter.ts";
import { lines, parseLine } from "./claude-events.ts";
import type { AgentEvent, Denial } from "./events.ts";

/** The plugin folder around the server's copy of the skill, passed to `--plugin-dir`. */
export const PLUGIN_DIR = fileURLToPath(new URL("../../plugin", import.meta.url));

/** A failed process keeps this many lines of stderr. */
const STDERR_LINES = 20;
/** The characters of stderr kept while a process runs, enough for its last lines. */
const STDERR_KEPT = 64_000;
/** `claude --version` gives up after this long. */
const VERSION_TIMEOUT_MS = 5_000;

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

/**
 * The narrowest allow rule for a blocked action, for `--allowedTools`. Claude Code checks files
 * against `Edit` and `Read` rules only, so a blocked `Write` gets an `Edit` rule. In a file rule,
 * `/path` is relative to the settings' folder, so an absolute path takes two slashes:
 * `Edit(//home/me/a)`. A tool with no target gets its bare name, which allows its every call for
 * the process.
 */
export function allowRule({ tool, input }: Denial): string {
  const value = (key: string) => (typeof input[key] === "string" ? input[key] : undefined);
  if (tool === "Bash" && value("command")) {
    return `Bash(${value("command")})`;
  }
  const file = value("file_path");
  if (["Edit", "Write", "MultiEdit", "Read"].includes(tool) && file) {
    const path = file.startsWith("/") && !file.startsWith("//") ? `/${file}` : file;
    return `${tool === "Read" ? "Read" : "Edit"}(${path})`;
  }
  const url = value("url");
  if (tool === "WebFetch" && url && URL.canParse(url)) {
    return `WebFetch(domain:${new URL(url).hostname})`;
  }
  return tool;
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
    steer: true,
    queue: true,
    takeBack: true,
    approvals: false,
    subagents: true,
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
        { timeout: VERSION_TIMEOUT_MS, encoding: "utf8" },
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

  allowRule(denial: Denial): string {
    return allowRule(denial);
  }

  open(options: OpenOptions): AgentProcess {
    const child = spawn(this.#command, claudeArgs(options, this.#pluginDir), {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
        resolve({
          type: "exit",
          code: null,
          stderr: error.message,
          ...(error.code === "ENOENT" ? { missing: true } : {}),
        });
      });
      // After stdout and stderr have closed, so nothing printed is lost.
      child.on("close", (code) => {
        const tail = stderr.trimEnd().split("\n").slice(-STDERR_LINES).join("\n");
        resolve({ type: "exit", code, stderr: tail });
      });
    });

    // Stdout is read as it comes, whether or not the events are: Claude Code loses its last lines
    // when they are read slowly.
    const events = new EventQueue();
    void (async () => {
      try {
        for await (const line of lines(child.stdout)) {
          for (const event of parseLine(line, options.cwd)) {
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
      write({ type: "control_request", request_id: randomUUID(), request });

    return {
      events,
      send: ({ id, text, when }) => {
        write({
          type: "user",
          message: { role: "user", content: text },
          uuid: id,
          priority: when === "steer" ? "next" : "later",
        });
      },
      takeBack: (id) => control({ subtype: "cancel_async_message", message_uuid: id }),
      interrupt: () => control({ subtype: "interrupt" }),
      close: () => {
        child.stdin.end();
      },
      kill: (signal) => {
        child.kill(signal);
      },
    };
  }
}
