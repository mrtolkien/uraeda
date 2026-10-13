import type { AgentEvent, Denial } from "./events.ts";

/** What an agent can do, which the UI offers and nothing more. */
export type Capabilities = {
  /** A message sent during a turn joins it. */
  steer: boolean;
  /** A message sent during a turn waits for the next one. */
  queue: boolean;
  /** A message not read yet can be taken back. */
  takeBack: boolean;
  /** The agent asks before an action, instead of skipping it. */
  approvals: boolean;
  /** The agent reports its sub-agents and their tools. */
  subagents: boolean;
};

/** How to open a session's process. */
export type OpenOptions = {
  /** The feature's worktree, or the main checkout. */
  cwd: string;
  /** The agent's own session ID. */
  nativeId: string;
  /** Resume `nativeId`, or start a new session with it. */
  resume: boolean;
  /** An allow rule for this process only, from "Allow and retry". */
  allowed?: string;
};

/** A message sent to an agent: steered into its turn, or queued after it. */
export type Outgoing = { id: string; text: string; when: "steer" | "queue" };

/** A session's open process, which takes messages until it is closed. */
export interface AgentProcess {
  /** Its events, ending after its `exit` event. */
  events: AsyncIterable<AgentEvent>;
  send(message: Outgoing): void;
  /** Takes back a message the agent has not read. */
  takeBack(id: string): void;
  /** Ends the running turn through the agent's own interrupt, and keeps the process. */
  interrupt(): void;
  /** Ends the process once its turn is over. */
  close(): void;
  kill(signal: "SIGINT" | "SIGTERM"): void;
}

/** The one interface every agent is reached through. */
export interface Adapter {
  /** The agent's kind, stored with its sessions: "claude". */
  readonly kind: string;
  /** The agent's name, for people: "Claude Code". */
  readonly name: string;
  readonly capabilities: Capabilities;
  /** The agent's version, or undefined when it is not available on this machine. */
  version(): Promise<string | undefined>;
  /** Whether the session's transcript exists, so it can be resumed. */
  hasSession(nativeId: string): boolean;
  /**
   * The narrowest rule that allows a blocked action, passed to `open` as `allowed`: undefined when
   * no rule allows that action alone.
   */
  allowRule(denial: Denial): string | undefined;
  open(options: OpenOptions): AgentProcess;
}
