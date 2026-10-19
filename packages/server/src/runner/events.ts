import type { ChatImage } from "./images.ts";

/** An action `auto` mode blocked, from a result's `permission_denials`. */
export type Denial = { input: Record<string, unknown>; tool: string };

/** Usage of the account's five-hour allowance, with its reset time in ISO 8601. */
export type UsageLimit = { percentUsed: number; resetsAt: string };

/**
 * Tokens the model read and wrote. `input` was read for the first time, `cacheWrite` read and
 * written to the cache, `cacheRead` read back from it.
 */
export type TokenCounts = { cacheRead: number; cacheWrite: number; input: number; output: number };

/** What an adapter reads from its agent's output, whatever the agent. */
export type AgentEvent =
  /** The agent's session, at the start of each turn. */
  | { pluginErrors: Array<string>; plugins: Array<string>; sessionId: string; type: "init" }
  /** A piece of the text being written. */
  | { text: string; type: "textDelta" }
  /** A text block, whole. */
  | { text: string; type: "text" }
  /**
   * What the agent writes that shows nothing yet: its thinking, or a tool call whose input
   * streams, with its target once the input names it.
   */
  | { activity: Activity; type: "activity" }
  | {
      id: string;
      input: Record<string, unknown>;
      kind: ToolKind;
      name: string;
      /** The tool call of the sub-agent that runs it. */
      parent?: string;
      /** Set when the tool starts a sub-agent. */
      subagent?: { description: string };
      /** The command, the path relative to the session's directory, the URL, or the pattern. */
      target?: string;
      type: "toolStart";
    }
  | { id: string; isError: boolean; output: string; type: "toolEnd" }
  /** The agent read a message sent to it. */
  | { id: string; type: "accepted" }
  /** A message was taken back before the agent read it. */
  | { id: string; type: "cancelled" }
  | { attempt: number; delayMs: number; error: string; type: "retry" }
  /** A usage report, shared by the account rather than added across sessions. */
  | { fiveHour: UsageLimit; type: "usage" }
  /**
   * The agent's background tasks still running, after one started or ended, by their tool calls:
   * its sub-agents and workflows, and its background commands. The agent goes on by itself when one
   * reports back.
   */
  | { tasks: Array<BackgroundTask>; type: "background" }
  /** The agent session's running total, its sub-agents included, sent before each result. */
  | { total: TokenCounts; type: "tokens" }
  /** The agent ended its reply. */
  | {
      /** The session's cost as the agent reports it, in dollars: absent when it reports none. */
      costUsd?: number;
      denials: Array<Denial>;
      errors: Array<string>;
      /** Ended by an interrupt: a stop, not an error. */
      interrupted: boolean;
      /** The models that answered, as the agent names them: absent when it names none. */
      models?: Array<string>;
      ok: boolean;
      type: "result";
    }
  /** A line the adapter does not read: not JSON, or of an unknown type. */
  | { type: "skipped" }
  /** The process ended. `missing` when its command could not be found. */
  | { code: number | null; missing?: boolean; stderr: string; type: "exit" };

/** What the main agent writes before anything of it shows. */
export type Activity = { kind: "thinking" } | { kind: "tool"; name: string; target?: string };

/** What a running turn does now, for the line at its end: "Thinking", and since when. */
export type TurnActivity = { label: string; since: string };

/** What a tool call does, in the Agent Client Protocol's words. */
export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "other";

/** Where a tool call is, in the Agent Client Protocol's words. */
export type ToolStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

/** A line of a turn, as the cache keeps it and the UI draws it: agent-neutral, never raw output. */
export type Item =
  /** A message sent to the agent: the human's, or the workflow's. */
  | {
      /** When it was sent, in ISO 8601: missing from messages cached before it was kept. */
      at?: string;
      id: string;
      /** The chat images sent with it; older messages have none. */
      images?: Array<ChatImage>;
      kind: "message";
      /** The chat's opening line, shown muted above the human's text. */
      opening?: string;
      origin: "human" | "workflow";
      /** Pending until the agent reads it, or taken back before. */
      state: "pending" | "read" | "taken-back";
      text: string;
    }
  /** An assistant text block, streaming until the block ends. */
  | { kind: "text"; streaming: boolean; text: string }
  | {
      durationMs?: number;
      /** The tool call's ID. */
      id: string;
      kind: "tool";
      /** `Bash`, `Read`, ... */
      name: string;
      /** The result's text, cut to its first 4,000 characters. */
      output?: string;
      /** The sub-agent that runs it. */
      parent?: string;
      status: ToolStatus;
      /** Set when the tool is a sub-agent. */
      subagent?: { description: string };
      /** The command, the path relative to the session's directory, the URL, or the pattern. */
      target?: string;
      toolKind: ToolKind;
    }
  /** A resumed or replaced session, a retry, skipped lines, an error. */
  | { kind: "system"; text: string }
  /**
   * An action `auto` mode blocked, and whether the human allowed it since. Without a rule, when
   * none allows that action alone, it cannot be allowed.
   */
  | { allowed: boolean; kind: "denial"; rule?: string; target?: string; tool: string };

/** Why a turn runs: a workflow step, the human's message, or a blocked action allowed. */
export type TurnKind = "workflow" | "chat" | "allow";

export type TurnState = "queued" | "running" | "done" | "failed" | "stopped";

/**
 * What started a workflow turn, which its message tells the agent: `comments` runs the comments
 * message on the feature's pull request.
 */
export type Trigger =
  | "answers"
  | "approval"
  | "changes"
  | "comments"
  | "proposal"
  | "start"
  | "manual";

/** A background task of the agent's run, by the tool call that started it. */
export type BackgroundTask = { kind: "subagent" | "command"; tool: string };
