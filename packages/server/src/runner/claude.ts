import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Adapter, AgentRun, StartOptions } from "./adapter.ts";
import type { AgentEvent, Denial } from "./events.ts";

/** The plugin folder around the server's copy of the skill, passed to `--plugin-dir`. */
export const PLUGIN_DIR = fileURLToPath(new URL("../../plugin", import.meta.url));

/** A failed run keeps this many lines of stderr. */
const STDERR_LINES = 20;
/** The characters of stderr kept while a run goes on, enough for its last lines. */
const STDERR_KEPT = 64_000;
/** `claude --version` gives up after this long. */
const VERSION_TIMEOUT_MS = 5_000;

/**
 * The line types Claude Code documents for stream-json output. Those the runner has no use for,
 * like hooks and rate limit status, give no event; any other type is skipped and counted.
 */
const KNOWN_TYPES = new Set([
  "assistant",
  "auth_status",
  "conversation_reset",
  "prompt_suggestion",
  "rate_limit_event",
  "result",
  "stream_event",
  "system",
  "tool_progress",
  "tool_use_summary",
  "user",
]);

/** The arguments of one run: print mode, stream-json both ways, `auto` mode, and the skill. */
export function claudeArgs(options: StartOptions): Array<string> {
  return [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "auto",
    "--plugin-dir",
    options.pluginDir,
    options.resume ? "--resume" : "--session-id",
    options.sessionId,
    ...(options.allowed === undefined ? [] : ["--allowedTools", options.allowed]),
  ];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const objects = (value: unknown): Array<Json> =>
  Array.isArray(value) ? value.filter(isObject) : [];
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** The events of one line of Claude Code's stream-json output. */
export function parseLine(line: string): Array<AgentEvent> {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return [{ type: "skipped" }];
  }
  if (!isObject(message) || typeof message.type !== "string" || !KNOWN_TYPES.has(message.type)) {
    return [{ type: "skipped" }];
  }
  switch (message.type) {
    case "system":
      return systemEvents(message);
    case "assistant":
      return objects(isObject(message.message) ? message.message.content : undefined).flatMap(
        (block): Array<AgentEvent> => {
          if (block.type === "text" && typeof block.text === "string" && block.text !== "") {
            return [{ type: "text", text: block.text }];
          }
          if (block.type === "tool_use" && typeof block.id === "string") {
            const input = isObject(block.input) ? block.input : {};
            return [{ type: "toolStart", id: block.id, name: text(block.name), input }];
          }
          return [];
        },
      );
    case "user":
      return objects(isObject(message.message) ? message.message.content : undefined).flatMap(
        (block): Array<AgentEvent> =>
          block.type === "tool_result" && typeof block.tool_use_id === "string"
            ? [
                {
                  type: "toolEnd",
                  id: block.tool_use_id,
                  isError: block.is_error === true,
                  output: toolOutput(block.content),
                },
              ]
            : [],
      );
    case "result":
      return [resultEvent(message)];
    default:
      return [];
  }
}

function systemEvents(message: Json): Array<AgentEvent> {
  if (message.subtype === "init") {
    return [
      {
        type: "init",
        sessionId: text(message.session_id),
        plugins: objects(message.plugins).map((plugin) => text(plugin.name)),
        // Printed as `null` when every plugin loaded.
        pluginErrors: objects(message.plugin_errors).map(
          (error) => text(error.message) || text(error.type) || "unknown error",
        ),
      },
    ];
  }
  if (message.subtype === "api_retry") {
    return [
      {
        type: "retry",
        attempt: typeof message.attempt === "number" ? message.attempt : 0,
        delayMs: typeof message.retry_delay_ms === "number" ? message.retry_delay_ms : 0,
        error: text(message.error) || "unknown",
      },
    ];
  }
  return [];
}

/** A tool result's content: a string, or text blocks. */
function toolOutput(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return objects(content)
    .filter((block) => block.type === "text")
    .map((block) => text(block.text))
    .join("\n");
}

function resultEvent(message: Json): AgentEvent {
  const ok = message.subtype === "success" && message.is_error !== true;
  const errors = Array.isArray(message.errors)
    ? message.errors.filter((error): error is string => typeof error === "string")
    : [];
  // A success that is an error, like an API error, says why in its result.
  if (!ok && errors.length === 0 && typeof message.result === "string" && message.result !== "") {
    errors.push(message.result);
  }
  const denials = objects(message.permission_denials).map((denial): Denial => ({
    tool: text(denial.tool_name),
    input: isObject(denial.tool_input) ? denial.tool_input : {},
  }));
  return {
    type: "result",
    ok,
    ...(typeof message.total_cost_usd === "number" ? { costUsd: message.total_cost_usd } : {}),
    errors,
    denials,
  };
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

export type ClaudeAdapterOptions = {
  /** The command to run, `claude` from the `PATH` by default. */
  command?: string;
  /** Claude Code's configuration folder, where it keeps its transcripts. */
  configDir?: string;
};

/** Claude Code, run through its installed `claude` command, in print mode. */
export class ClaudeAdapter implements Adapter {
  #command: string;
  #configDir: string;

  constructor({
    command = "claude",
    configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
  }: ClaudeAdapterOptions = {}) {
    this.#command = command;
    this.#configDir = configDir;
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
  hasSession(sessionId: string): boolean {
    const projects = join(this.#configDir, "projects");
    let folders: Array<string>;
    try {
      folders = readdirSync(projects);
    } catch {
      return false;
    }
    return folders.some((folder) => existsSync(join(projects, folder, `${sessionId}.jsonl`)));
  }

  start(options: StartOptions): AgentRun {
    const child = spawn(this.#command, claudeArgs(options), {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    // Only its end is kept: a failed run shows its last lines.
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data: string) => {
      stderr = (stderr + data).slice(-STDERR_KEPT);
    });
    // A process that exits early closes stdin before it reads the message.
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
    child.stdin.end(
      `${JSON.stringify({ type: "user", message: { role: "user", content: options.message } })}\n`,
    );

    return {
      events: (async function* () {
        for await (const line of lines(child.stdout)) {
          yield* parseLine(line);
        }
        yield await exited;
      })(),
      interrupt: () => {
        child.kill("SIGINT");
      },
      terminate: () => {
        child.kill("SIGTERM");
      },
    };
  }
}
