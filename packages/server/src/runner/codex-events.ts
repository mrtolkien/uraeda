import { codexLimit, codexWindows } from "./codex-limits.ts";
import { effortName } from "./efforts.ts";
import type { AgentEvent, TokenCounts, ToolKind } from "./events.ts";
import { toolTarget } from "./message.ts";

/**
 * Codex's `app-server` notifications into agent-neutral events. Codex's formats stay here, in its
 * adapter: the field names follow the protocol's generated types, `ServerNotification` and
 * `ThreadItem` (Codex 0.163.0).
 */

/** A JSON-RPC notification of `codex app-server`: a message without an `id`. */
export type CodexNotification = { method: string; params: unknown };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): Array<string> =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === "string") : [];

/** A shell's command line, `bash -lc '…'`, as Codex runs each command. */
const SHELL = /^(?:\S*\/)?(?:bash|zsh|sh) -lc (.+)$/s;

/**
 * The command a shell runs, its quotes undone: Codex reports `/usr/bin/bash -lc "git commit"`,
 * shown as `git commit`. Any other command line is kept whole.
 */
export function shellCommand(command: string): string {
  const argument = SHELL.exec(command)?.[1];
  if (argument === undefined) {
    return command;
  }
  const single = /^'((?:[^']|'\\'')*)'$/s.exec(argument)?.[1];
  if (single !== undefined) {
    return single.replaceAll(String.raw`'\''`, "'");
  }
  const double = /^"((?:[^"\\]|\\.)*)"$/s.exec(argument)?.[1];
  return double === undefined ? command : double.replaceAll(/\\([\\"$`])/g, "$1");
}

/** A tool call's start, the fields of `toolStart` an item gives. */
type Tool = {
  input: Record<string, unknown>;
  kind: ToolKind;
  name: string;
  subagent?: { description: string };
  target?: string;
};

/** A file change's paths, relative to the session's directory when under it. */
function changedPaths(changes: Array<Json>, cwd: string): string | undefined {
  const paths = changes.flatMap((change) => {
    const path = toolTarget("Edit", { path: text(change.path) }, cwd);
    return path ? [path] : [];
  });
  return paths.length > 0 ? paths.join(", ") : undefined;
}

/** A tool call's target, when it has one. */
const target = (value: string | undefined) => (value ? { target: value } : {});

/** The tool call an item is, Codex's item types under the names the transcript shows. */
function toolOf(item: Json, cwd: string): Tool | undefined {
  switch (item.type) {
    case "commandExecution":
      return {
        input: { command: text(item.command), cwd: text(item.cwd) },
        kind: "execute",
        name: "Shell",
        ...target(shellCommand(text(item.command))),
      };
    case "fileChange": {
      const changes = Array.isArray(item.changes) ? item.changes.filter(isObject) : [];
      const files = changes.map((change) => ({ kind: change.kind, path: text(change.path) }));
      return {
        input: { changes: files },
        kind: "edit",
        name: "Edit",
        ...target(changedPaths(changes, cwd)),
      };
    }
    case "mcpToolCall":
    case "dynamicToolCall": {
      const input = isObject(item.arguments) ? item.arguments : {};
      const name =
        item.type === "mcpToolCall"
          ? `mcp__${text(item.server)}__${text(item.tool)}`
          : text(item.tool);
      return { input, kind: "other", name, ...target(toolTarget(name, input, cwd)) };
    }
    case "webSearch": {
      const action = isObject(item.action) ? item.action : {};
      const query = text(item.query) || text(action.query) || text(action.url);
      return { input: { query }, kind: "fetch", name: "WebSearch", ...target(query) };
    }
    case "collabAgentToolCall":
      return {
        input: { model: item.model, prompt: item.prompt },
        kind: "other",
        name: text(item.tool),
        // A spawned agent's prompt says what it does.
        ...(item.tool === "spawnAgent" ? { subagent: { description: text(item.prompt) } } : {}),
      };
    default:
      return undefined;
  }
}

/** A completed tool item's output, and whether it failed. */
function endOf(item: Json): { isError: boolean; output: string } {
  const failed = item.status !== "completed";
  switch (item.type) {
    case "commandExecution": {
      const code = typeof item.exitCode === "number" ? item.exitCode : 0;
      return { isError: failed || code !== 0, output: text(item.aggregatedOutput) };
    }
    case "fileChange": {
      const changes = Array.isArray(item.changes) ? item.changes.filter(isObject) : [];
      return { isError: failed, output: changes.map((change) => text(change.diff)).join("\n") };
    }
    case "mcpToolCall": {
      const error = isObject(item.error) ? text(item.error.message) : "";
      const content = isObject(item.result) ? item.result.content : undefined;
      return { isError: failed, output: error || textBlocks(content) };
    }
    case "dynamicToolCall":
      return { isError: item.success === false || failed, output: textBlocks(item.contentItems) };
    case "collabAgentToolCall": {
      const states = isObject(item.agentsStates) ? Object.values(item.agentsStates) : [];
      const said = states.flatMap((state) =>
        isObject(state) && text(state.message) ? [text(state.message)] : [],
      );
      return { isError: item.status === "failed", output: said.join("\n") };
    }
    default:
      return { isError: false, output: "" };
  }
}

/** The text of a tool result's content blocks. */
const textBlocks = (content: unknown): string =>
  (Array.isArray(content) ? content.filter(isObject) : [])
    .filter((block) => typeof block.text === "string")
    .map((block) => text(block.text))
    .join("\n");

/** Where a notification belongs: the session's own thread, a sub-agent's under its call, or neither. */
type Scope = { parent?: string } | undefined;

/**
 * The events of one Codex process's notifications, read in order. It keeps what a notification
 * alone does not say: the session's thread and its sub-agents' threads, the text streamed by each
 * message, the tool items already started, the last usage report, and the current turn's ID, for
 * the caller to steer or interrupt it.
 */
export class CodexEvents {
  readonly #cwd: string;
  readonly #names: (model: string) => string;
  #thread: string | undefined;
  #turn: string | undefined;
  /** The effort the thread's settings name; none at the default. */
  #effort: string | undefined;
  /** The effort Codex resolved the thread to at its start, the default's when none is named. */
  #resolved: string | undefined;
  readonly #texts = new Map<string, string>();
  readonly #started = new Set<string>();
  /** The sub-agents' threads, by the tool call that spawned each. */
  readonly #children = new Map<string, string>();
  #limits: Json | undefined;

  /**
   * `cwd`, the session's directory, makes targets under it relative; `names` gives a model's name
   * for people, from the runtime's model list.
   */
  constructor(cwd: string, names: (model: string) => string) {
    this.#cwd = cwd;
    this.#names = names;
  }

  /** The turn running or last run, from its `turn/started`. */
  get turnId(): string | undefined {
    return this.#turn;
  }

  /** The events of one notification: none for one Uraeda has no use for. */
  read({ method, params }: CodexNotification): Array<AgentEvent> {
    if (!isObject(params)) {
      return [];
    }
    if (method === "thread/started") {
      return this.#threadStarted(params.thread);
    }
    if (method === "account/rateLimits/updated") {
      return this.#rateLimits(params.rateLimits);
    }
    const scope = this.#scope(params);
    if (scope === undefined) {
      return [];
    }
    if (method.startsWith("item/")) {
      return this.#item(method, params, scope.parent);
    }
    return scope.parent === undefined ? this.#own(method, params) : [];
  }

  /**
   * The session's thread starting gives its ID, and what it runs on when it says: a resumed thread
   * gets no settings update. A sub-agent's thread gives none.
   */
  #threadStarted(thread: unknown): Array<AgentEvent> {
    if (!isObject(thread) || typeof thread.id !== "string" || thread.parentThreadId) {
      return [];
    }
    this.#thread = thread.id;
    this.#resolved = text(thread.reasoningEffort) || this.#resolved;
    return [{ sessionId: thread.id, type: "init" }, ...this.#runsOn(text(thread.model))];
  }

  /** A notification's thread: the session's own, or a sub-agent's under its call; any other, none. */
  #scope(params: Json): Scope {
    const thread = params.threadId;
    if (typeof thread !== "string" || thread === this.#thread) {
      return {};
    }
    const parent = this.#children.get(thread);
    if (parent !== undefined) {
      return { parent };
    }
    // A resumed thread may not report its start: the first thread heard from is the session's.
    if (this.#thread === undefined) {
      this.#thread = thread;
      return {};
    }
    return undefined;
  }

  /** The usage windows of a sparse report, merged over the last, and a limit it says was reached. */
  #rateLimits(report: unknown): Array<AgentEvent> {
    if (!isObject(report)) {
      return [];
    }
    const merged: Json = { ...this.#limits };
    for (const [key, value] of Object.entries(report)) {
      if (value !== null || key === "rateLimitReachedType") {
        merged[key] = value;
      }
    }
    this.#limits = merged;
    const windows = codexWindows(merged);
    const limit = codexLimit(merged);
    return [
      ...(windows.length > 0 ? [{ type: "usage" as const, windows }] : []),
      ...(limit ? [{ limit, type: "limit" as const }] : []),
    ];
  }

  /** The session's thread's own notifications: its settings, tokens, and turns. */
  #own(method: string, params: Json): Array<AgentEvent> {
    switch (method) {
      case "thread/settings/updated": {
        const settings = isObject(params.threadSettings) ? params.threadSettings : {};
        const effort = text(settings.effort);
        this.#effort = effort || undefined;
        return this.#runsOn(text(settings.model));
      }
      case "model/rerouted":
        return this.#runsOn(text(params.toModel));
      case "thread/tokenUsage/updated":
        return tokensOf(isObject(params.tokenUsage) ? params.tokenUsage.total : undefined);
      case "turn/started": {
        const turn = isObject(params.turn) ? params.turn : {};
        this.#turn = text(turn.id) || this.#turn;
        return [];
      }
      case "turn/completed":
        return this.#turnCompleted(isObject(params.turn) ? params.turn : {});
      default:
        return [];
    }
  }

  /** What the thread runs on: at the default effort, the one Codex resolved. */
  #runsOn(model: string): Array<AgentEvent> {
    if (model === "") {
      return [];
    }
    const effort = this.#effort ?? this.#resolved;
    return [
      {
        model: this.#names(model),
        type: "runsOn",
        ...(effort === undefined ? {} : { effort: effortName(effort) }),
      },
    ];
  }

  /** A turn's end: its usage limit first, when one refused it, then its result. */
  #turnCompleted(turn: Json): Array<AgentEvent> {
    const error = isObject(turn.error) ? turn.error : undefined;
    const limit = turn.status === "failed" ? codexLimit(this.#limits, error) : undefined;
    const message = error ? text(error.message) : "";
    return [
      ...(limit ? [{ limit, type: "limit" as const }] : []),
      {
        denials: [],
        errors: turn.status === "failed" ? [message || "The turn failed."] : [],
        interrupted: turn.status === "interrupted",
        ok: turn.status === "completed",
        type: "result",
      },
    ];
  }

  /** An item's notifications: its start, its streamed text, its end, and its review. */
  #item(method: string, params: Json, parent: string | undefined): Array<AgentEvent> {
    switch (method) {
      case "item/started":
        return isObject(params.item) ? this.#itemStarted(params.item, parent) : [];
      case "item/completed":
        return isObject(params.item) ? this.#itemCompleted(params.item, parent) : [];
      case "item/agentMessage/delta":
        return parent === undefined ? this.#delta(text(params.itemId), text(params.delta)) : [];
      case "item/autoApprovalReview/completed":
        return reviewNotice(params.review);
      default:
        return [];
    }
  }

  #delta(item: string, delta: string): Array<AgentEvent> {
    if (delta === "") {
      return [];
    }
    this.#texts.set(item, (this.#texts.get(item) ?? "") + delta);
    return [{ text: delta, type: "textDelta" }];
  }

  #itemStarted(item: Json, parent: string | undefined): Array<AgentEvent> {
    if (item.type === "reasoning") {
      return parent === undefined ? [{ activity: { kind: "thinking" }, type: "activity" }] : [];
    }
    return this.#toolStart(item, parent);
  }

  /** A tool item's start, once: an item first seen completed starts as it ends. */
  #toolStart(item: Json, parent: string | undefined): Array<AgentEvent> {
    const id = text(item.id);
    const tool = toolOf(item, this.#cwd);
    if (!tool || id === "" || this.#started.has(id)) {
      return [];
    }
    this.#started.add(id);
    return [{ id, type: "toolStart", ...tool, ...(parent === undefined ? {} : { parent }) }];
  }

  #itemCompleted(item: Json, parent: string | undefined): Array<AgentEvent> {
    const id = text(item.id);
    if (item.type === "agentMessage") {
      const streamed = this.#texts.get(id) ?? "";
      this.#texts.delete(id);
      // A sub-agent's text is not the session's: only its tools and thoughts are shown.
      const whole = text(item.text) || streamed;
      return parent === undefined && whole !== "" ? [{ text: whole, type: "text" }] : [];
    }
    if (item.type === "reasoning") {
      const said = strings(item.summary).join("\n\n") || strings(item.content).join("\n\n");
      return [
        {
          type: "thought",
          ...(parent === undefined ? {} : { parent }),
          ...(said ? { text: said } : {}),
        },
      ];
    }
    if (item.type === "collabAgentToolCall" && item.tool === "spawnAgent") {
      for (const thread of strings(item.receiverThreadIds)) {
        this.#children.set(thread, id);
      }
    }
    const start = this.#toolStart(item, parent);
    if (!this.#started.has(id)) {
      return [];
    }
    this.#started.delete(id);
    return [...start, { id, type: "toolEnd", ...endOf(item) }];
  }
}

/**
 * The final statuses of a review, `GuardianApprovalReviewStatus` but `inProgress`, as people read
 * them: a decision carries its risk, a review that ended without one does not.
 */
const REVIEW_ENDS = new Map<string, { risk: boolean; said: string }>([
  ["aborted", { risk: false, said: "aborted" }],
  ["approved", { risk: true, said: "approved" }],
  ["denied", { risk: true, said: "denied" }],
  ["timedOut", { risk: false, said: "timed out" }],
]);

/** Codex's automatic review of an escalated action, as a line for the transcript, once it ends. */
function reviewNotice(review: unknown): Array<AgentEvent> {
  const end = isObject(review) ? REVIEW_ENDS.get(text(review.status)) : undefined;
  if (!isObject(review) || end === undefined) {
    return [];
  }
  const risk = text(review.riskLevel) || (end.risk ? "unknown" : "");
  const rationale = text(review.rationale);
  const verdict = `Automatic review ${end.said}${risk ? ` (risk: ${risk})` : ""}`;
  return [{ text: rationale ? `${verdict}: ${rationale}` : verdict, type: "notice" }];
}

/**
 * The thread's running total: input read for the first time, less what the cache gave back, as
 * Claude Code counts it. None for an all-zero total, which would read as a new agent session.
 */
function tokensOf(total: unknown): Array<AgentEvent> {
  if (!isObject(total)) {
    return [];
  }
  const count = (key: string) =>
    typeof total[key] === "number" && Number.isFinite(total[key]) ? total[key] : 0;
  const counts: TokenCounts = {
    cacheRead: count("cachedInputTokens"),
    cacheWrite: count("cacheWriteInputTokens"),
    input: Math.max(0, count("inputTokens") - count("cachedInputTokens")),
    output: count("outputTokens"),
  };
  return Object.values(counts).some((value) => value > 0)
    ? [{ total: counts, type: "tokens" }]
    : [];
}
