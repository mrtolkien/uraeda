import type { AgentEvent } from "./events.ts";

/** How to start one run of an agent. */
export type StartOptions = {
  /** The feature's worktree. */
  cwd: string;
  /** The run's single message. */
  message: string;
  sessionId: string;
  /** Resume `sessionId`, or start a new session with it. */
  resume: boolean;
  /** The plugin folder that holds the Uraeda skill. */
  pluginDir: string;
  /** An allow rule for this run only, from "Allow and continue". */
  allowed?: string;
};

/** A started agent process. */
export interface AgentRun {
  /** Its events, ending after its `exit` event. */
  events: AsyncIterable<AgentEvent>;
  /** Sends SIGINT. */
  interrupt(): void;
  /** Sends SIGTERM. */
  terminate(): void;
}

/** The one interface every agent is reached through. */
export interface Adapter {
  /** The agent's version, or undefined when it is not available on this machine. */
  version(): Promise<string | undefined>;
  /** Whether the session's transcript exists, so it can be resumed. */
  hasSession(sessionId: string): boolean;
  start(options: StartOptions): AgentRun;
}
