/** An action `auto` mode blocked, from a result's `permission_denials`. */
export type Denial = { tool: string; input: Record<string, unknown> };

/** What an adapter reads from its agent's output, whatever the agent. */
export type AgentEvent =
  /** The agent's session, at the start of each turn. */
  | { type: "init"; sessionId: string; plugins: Array<string>; pluginErrors: Array<string> }
  /** A piece of the text being written. */
  | { type: "textDelta"; text: string }
  /** A text block, whole. */
  | { type: "text"; text: string }
  | {
      type: "toolStart";
      id: string;
      name: string;
      kind: ToolKind;
      input: Record<string, unknown>;
      /** The command, the path relative to the session's directory, the URL, or the pattern. */
      target?: string;
      /** The tool call of the sub-agent that runs it. */
      parent?: string;
      /** Set when the tool starts a sub-agent. */
      subagent?: { description: string };
    }
  | { type: "toolEnd"; id: string; isError: boolean; output: string }
  /** The agent read a message sent to it. */
  | { type: "accepted"; id: string }
  /** A message was taken back before the agent read it. */
  | { type: "cancelled"; id: string }
  | { type: "retry"; attempt: number; delayMs: number; error: string }
  /** The turn ended. `costUsd` is the process's total so far. */
  | {
      type: "result";
      ok: boolean;
      costUsd?: number;
      errors: Array<string>;
      denials: Array<Denial>;
      /** Ended by an interrupt: a stop, not an error. */
      interrupted: boolean;
    }
  /** A line the adapter does not read: not JSON, or of an unknown type. */
  | { type: "skipped" }
  /** The process ended. `missing` when its command could not be found. */
  | { type: "exit"; code: number | null; stderr: string; missing?: boolean };

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
      kind: "message";
      id: string;
      text: string;
      origin: "human" | "workflow";
      /** The chat's opening line, shown muted above the human's text. */
      opening?: string;
      /** Pending until the agent reads it, or taken back before. */
      state: "pending" | "read" | "taken-back";
    }
  /** An assistant text block, streaming until the block ends. */
  | { kind: "text"; text: string; streaming: boolean }
  | {
      kind: "tool";
      /** The tool call's ID. */
      id: string;
      /** `Bash`, `Read`, ... */
      name: string;
      toolKind: ToolKind;
      /** The command, the path relative to the session's directory, the URL, or the pattern. */
      target?: string;
      status: ToolStatus;
      durationMs?: number;
      /** The result's text, cut to its first 4,000 characters. */
      output?: string;
      /** The sub-agent that runs it. */
      parent?: string;
      /** Set when the tool is a sub-agent. */
      subagent?: { description: string };
    }
  /** A resumed or replaced session, a retry, skipped lines, an error. */
  | { kind: "system"; text: string }
  /** An action `auto` mode blocked, and whether the human allowed it since. */
  | { kind: "denial"; tool: string; target?: string; rule: string; allowed: boolean };

/** Why a turn runs: a workflow step, the human's message, or a blocked action allowed. */
export type TurnKind = "workflow" | "chat" | "allow";

export type TurnState = "queued" | "running" | "done" | "failed" | "stopped";

/** What started a workflow turn, which its message tells the agent. */
export type Trigger = "answers" | "approval" | "changes" | "proposal" | "start" | "manual";
