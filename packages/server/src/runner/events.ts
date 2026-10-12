/** An action `auto` mode blocked, from a result's `permission_denials`. */
export type Denial = { tool: string; input: Record<string, unknown> };

/** What an adapter reads from its agent's output, whatever the agent. */
export type AgentEvent =
  | { type: "init"; sessionId: string; plugins: Array<string>; pluginErrors: Array<string> }
  | { type: "text"; text: string }
  | { type: "toolStart"; id: string; name: string; input: Record<string, unknown> }
  | { type: "toolEnd"; id: string; isError: boolean; output: string }
  | { type: "retry"; attempt: number; delayMs: number; error: string }
  | { type: "result"; ok: boolean; costUsd?: number; errors: Array<string>; denials: Array<Denial> }
  /** A line the adapter does not read: not JSON, or of an unknown type. */
  | { type: "skipped" }
  /** The process ended. `missing` when its command could not be found. */
  | { type: "exit"; code: number | null; stderr: string; missing?: boolean };

/** A line of a run's log, as the runner keeps it: parsed, not the agent's raw output. */
export type RunEvent =
  /** An assistant text block, as written. */
  | { kind: "text"; text: string }
  | {
      kind: "tool";
      /** The tool use's ID. */
      id: string;
      /** `Bash`, `Read`, ... */
      name: string;
      /** The command, the file path, the URL, or the pattern. */
      target?: string;
      status: "running" | "complete" | "error";
      durationMs?: number;
      /** The result's text, cut to its first 4,000 characters. */
      output?: string;
    }
  /** A resumed or replaced session, a retry, skipped lines, an error. */
  | { kind: "system"; text: string }
  | { kind: "denial"; tool: string; target?: string; rule: string };

export type RunState = "running" | "done" | "failed" | "stopped";

/** What started a run, which its message tells the agent. */
export type Trigger =
  | "answers"
  | "approval"
  | "changes"
  | "proposal"
  | "start"
  | "manual"
  | "allow";
