import type { Activity, AgentEvent, Denial, ToolKind } from "./events.ts";
import { toolTarget } from "./message.ts";

/**
 * The line types Claude Code prints in stream-json output. Those the adapter has no use for, like
 * hooks, rate limit status, and the answers to its control requests, give no event; any other type
 * is skipped and counted.
 */
const KNOWN_TYPES = new Set([
  "assistant",
  "auth_status",
  "command_lifecycle",
  "control_response",
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

/** The tools that start a sub-agent: `Task` in Claude Code 2.1.296, `Agent` in others. */
const SUBAGENT_TOOLS = new Set(["Task", "Agent"]);

/**
 * The narrowest allow rule for a blocked action, for `--allowedTools`. Claude Code checks files
 * against `Edit` and `Read` rules only, so a blocked `Write` gets an `Edit` rule. In a file rule,
 * `/path` is relative to the settings' folder, so an absolute path takes two slashes:
 * `Edit(//home/me/a)`. A tool with no target gets its bare name, which allows its every call for
 * the process.
 *
 * A Bash rule with a `*` is a wildcard, which Claude Code cannot be told to read literally: a
 * command with one has no rule. A file rule is a gitignore pattern, so its special characters are
 * escaped, as Claude Code escapes the paths it saves.
 */
export function allowRule({ tool, input }: Denial): string | undefined {
  const value = (key: string) => (typeof input[key] === "string" ? input[key] : undefined);
  const command = value("command");
  if (tool === "Bash" && command) {
    return command.includes("*") ? undefined : `Bash(${command})`;
  }
  const file = value("file_path");
  if (["Edit", "Write", "MultiEdit", "Read"].includes(tool) && file) {
    const escaped = file.replace(/[\\*?[\]]/g, "\\$&").replace(/^[!#]/, "\\$&");
    const path = escaped.startsWith("/") && !escaped.startsWith("//") ? `/${escaped}` : escaped;
    return `${tool === "Read" ? "Read" : "Edit"}(${path})`;
  }
  const url = value("url");
  if (tool === "WebFetch" && url && URL.canParse(url)) {
    return `WebFetch(domain:${new URL(url).hostname})`;
  }
  return tool;
}

const KINDS: Record<string, ToolKind> = {
  Read: "read",
  Edit: "edit",
  Write: "edit",
  NotebookEdit: "edit",
  MultiEdit: "edit",
  Grep: "search",
  Glob: "search",
  LS: "search",
  Bash: "execute",
  BashOutput: "execute",
  KillShell: "execute",
  WebFetch: "fetch",
  WebSearch: "fetch",
};

/** What a Claude Code tool does, in the Agent Client Protocol's words. */
export function toolKind(name: string): ToolKind {
  return KINDS[name] ?? "other";
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const objects = (value: unknown): Array<Json> =>
  Array.isArray(value) ? value.filter(isObject) : [];
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * The events of one line of Claude Code's stream-json output. `cwd`, the session's directory, makes
 * tool targets under it relative. `tasks`, kept across a process's lines, maps its background
 * tasks to the tool calls that started them, and `blocks` the main agent's tool calls being written
 * to their input so far.
 */
export function parseLine(
  line: string,
  cwd?: string,
  tasks = new Map<string, string>(),
  blocks: Blocks = new Map(),
): Array<AgentEvent> {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return [{ type: "skipped" }];
  }
  if (!isObject(message) || typeof message.type !== "string" || !KNOWN_TYPES.has(message.type)) {
    return [{ type: "skipped" }];
  }
  // A sub-agent's lines carry the tool call that started it; the main agent's carry null.
  const parent =
    typeof message.parent_tool_use_id === "string" ? message.parent_tool_use_id : undefined;
  switch (message.type) {
    case "system":
      return systemEvents(message, tasks);
    case "stream_event":
      return parent === undefined ? streamEvents(message.event, blocks, cwd) : [];
    case "command_lifecycle":
      return lifecycleEvents(message);
    case "assistant":
      return objects(isObject(message.message) ? message.message.content : undefined).flatMap(
        (block): Array<AgentEvent> => {
          // A sub-agent's text is not the main agent's: only its tools are shown.
          if (block.type === "text" && typeof block.text === "string" && block.text !== "") {
            return parent === undefined ? [{ type: "text", text: block.text }] : [];
          }
          if (block.type === "tool_use" && typeof block.id === "string") {
            return [toolStart(block.id, text(block.name), block.input, parent, cwd)];
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

function toolStart(
  id: string,
  name: string,
  rawInput: unknown,
  parent: string | undefined,
  cwd: string | undefined,
): AgentEvent {
  const input = isObject(rawInput) ? rawInput : {};
  const target = toolTarget(name, input, cwd);
  return {
    type: "toolStart",
    id,
    name,
    kind: toolKind(name),
    input,
    ...(target === undefined ? {} : { target }),
    ...(parent === undefined ? {} : { parent }),
    ...(SUBAGENT_TOOLS.has(name) ? { subagent: { description: text(input.description) } } : {}),
  };
}

/** The main agent's tool calls being written, by their block's index: their name, and input so far. */
export type Blocks = Map<number, { name: string; input: string; target?: string }>;

/** A file path, whole, in a tool call's input still being written. */
const FILE_PATH = /"file_path"\s*:\s*("(?:[^"\\]|\\.)*")/;

/**
 * The main agent's text deltas, from `--include-partial-messages`, and what it writes that shows
 * nothing yet: a thinking block, or a tool call, named again once its input holds a file path.
 * Thinking deltas say nothing new.
 */
function streamEvents(event: unknown, blocks: Blocks, cwd: string | undefined): Array<AgentEvent> {
  if (!isObject(event) || typeof event.index !== "number") {
    return [];
  }
  const activity = (value: Activity): Array<AgentEvent> => [{ type: "activity", activity: value }];
  if (event.type === "content_block_start" && isObject(event.content_block)) {
    const block = event.content_block;
    if (block.type === "thinking" || block.type === "redacted_thinking") {
      return activity({ kind: "thinking" });
    }
    if (block.type === "tool_use" && typeof block.name === "string") {
      blocks.set(event.index, { name: block.name, input: "" });
      return activity({ kind: "tool", name: block.name });
    }
    return [];
  }
  if (event.type === "content_block_stop") {
    blocks.delete(event.index);
    return [];
  }
  if (event.type !== "content_block_delta" || !isObject(event.delta)) {
    return [];
  }
  const { delta } = event;
  if (delta.type === "text_delta" && typeof delta.text === "string" && delta.text !== "") {
    return [{ type: "textDelta", text: delta.text }];
  }
  const tool = blocks.get(event.index);
  if (delta.type !== "input_json_delta" || typeof delta.partial_json !== "string" || !tool) {
    return [];
  }
  if (tool.target !== undefined) {
    return [];
  }
  tool.input += delta.partial_json;
  const path = FILE_PATH.exec(tool.input)?.[1];
  const target =
    path === undefined ? undefined : toolTarget(tool.name, { file_path: JSON.parse(path) }, cwd);
  if (target === undefined) {
    return [];
  }
  tool.target = target;
  tool.input = "";
  return activity({ kind: "tool", name: tool.name, target });
}

/** A message the agent read, or one taken back. Queued and completed say nothing new. */
function lifecycleEvents(message: Json): Array<AgentEvent> {
  if (typeof message.command_uuid !== "string") {
    return [];
  }
  if (message.state === "started") {
    return [{ type: "accepted", id: message.command_uuid }];
  }
  if (message.state === "cancelled") {
    return [{ type: "cancelled", id: message.command_uuid }];
  }
  return [];
}

function systemEvents(message: Json, tasks: Map<string, string>): Array<AgentEvent> {
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
  if (
    message.subtype === "task_started" &&
    typeof message.task_id === "string" &&
    typeof message.tool_use_id === "string"
  ) {
    tasks.set(message.task_id, message.tool_use_id);
    return [];
  }
  // Every live background task: shells and watchers may never end, so only the sub-agents and
  // workflows the agent waits for count.
  if (message.subtype === "background_tasks_changed" && Array.isArray(message.tasks)) {
    const tools = objects(message.tasks)
      .filter(
        (task) =>
          (task.task_type === "local_agent" || task.task_type === "local_workflow") &&
          task.ambient !== true,
      )
      .map((task) => tasks.get(text(task.task_id)) ?? text(task.task_id));
    return [{ type: "background", tools }];
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
    errors,
    denials,
    // An interrupt ends the turn this way, with only diagnostics in its errors.
    interrupted: message.terminal_reason === "aborted_streaming",
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
