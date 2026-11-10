import type { AgentEvent, Denial } from "./events.ts";

/** What an agent can do, which the UI offers and nothing more. */
export type Capabilities = {
  /** The agent asks before an action, instead of skipping it. */
  approvals: boolean;
  /** The agent opens the images sent with a message, by their paths. */
  images: boolean;
  /** A message sent during a turn waits for the next one. */
  queue: boolean;
  /** A message sent during a turn joins it. */
  steer: boolean;
  /** The agent reports its sub-agents and their tools. */
  subagents: boolean;
  /** A message not read yet can be taken back. */
  takeBack: boolean;
};

/** An effort a model takes: the agent's ID for it, and its name for people. */
export type ModelEffort = { id: string; name: string };

/** A model the agent lists for the account. */
export type AgentModel = {
  /** The agent's line about it. */
  description?: string;
  /** The efforts it takes, in the agent's order: empty for none. */
  efforts: Array<ModelEffort>;
  /** The agent's ID, which a session stores as its model. */
  id: string;
  /** Its name for people. */
  name: string;
};

/**
 * The models a runtime lists, in the agent's order, and the model and effort the agent runs on when
 * none is picked, by their IDs.
 */
export type ModelList = {
  defaults: { effort?: string; model?: string };
  models: Array<AgentModel>;
};

/** A usage window of an account: no reset while the window is not open. */
export type AccountWindow = { id: string; label: string; resetsAt: string | null; used: number };

/** Whether an account can run a session: signed in, signed out, or without its folder. */
export type AccountState = "ready" | "signed-out" | "missing";

/** An account a runtime offers. `windows` are shortest first: Claude's five hours, then its week. */
export type Account = {
  /**
   * When its usage was last read, epoch ms: null while it never was, or while its last ask could not
   * read it. `windows` keep the last windows read either way, for the panes.
   */
  askedAt: number | null;
  /** What a session stores: for Claude Code, its folder as an absolute path. */
  id: string;
  name: string;
  state: AccountState;
  windows: ReadonlyArray<AccountWindow>;
};

/** The accounts a runtime offers, an optional part of its contract. */
export interface Accounts {
  /** The accounts as last asked, in the listed order. */
  list(): ReadonlyArray<Account>;
  /** The name of the account `id`, listed or not. */
  nameOf(id: string): string;
  /** What needs the human, in the runtime's words: "account b is signed out, in ~/.claude-b". */
  problems(): ReadonlyArray<string>;
  /**
   * Asks again each account whose last ask, answered or not, is older than `maxAgeMs`: the runtime
   * keeps that time itself. Settles once they answered.
   */
  refresh(maxAgeMs: number): Promise<void>;
}

/** How to open a session's process. */
export type OpenOptions = {
  /** The account to run on, by its ID: none for the agent's own. */
  account?: string;
  /** The allow rules for this process only, from "Allow and retry" or "Allow all". */
  allowed?: ReadonlyArray<string>;
  /** The feature's worktree, or the main checkout. */
  cwd: string;
  /** The effort to run on, by the agent's ID: none for the agent's default. */
  effort?: string;
  /** The model to run on, by the agent's ID: none for the agent's default. */
  model?: string;
  /**
   * The agent's own session ID. An agent that picks its own, when not resuming, reports it in its
   * first `init`, which the session adopts.
   */
  nativeId: string;
  /** Resume `nativeId`, or start a new session with it. */
  resume: boolean;
  /** The skill folders to give the agent, beside Uraeda's own. */
  skills: ReadonlyArray<string>;
  /**
   * Uraeda's tools, which start sub-agents as sessions of the feature: for a workflow session, the
   * MCP endpoint's URL and its process's token, given instead of the agent's own sub-agents; for a
   * sub-session, `"none"`, neither. A chat has none set, and keeps the agent's own sub-agents.
   */
  tools?: UraedaTools | "none";
};

/** Uraeda's MCP endpoint, `<server>/mcp`, and the token of one agent process there. */
export type UraedaTools = { token: string; url: string };

/**
 * A message sent to an agent: steered into its turn, or queued after it, with the paths of its chat
 * images, which the adapter writes to its agent in the agent's own way.
 */
export type Outgoing = {
  id: string;
  images: Array<{ path: string }>;
  /**
   * The text is the instructions of a review the agent runs as its own, as Codex's `review/start`
   * does: set by `reviewMessage` only.
   */
  review?: boolean;
  text: string;
  when: "steer" | "queue";
};

/**
 * A review an agent runs: the commits `<base>..<head>`, at `effort`, the reviewer's effort, else
 * its model's default, with `instructions` added to the agent's own review prompt.
 */
export type ReviewAsk = { base: string; effort?: string; head: string; instructions?: string };

/** The message that runs a review in the agent's own way: its text, and `Outgoing.review`. */
export type ReviewMessage = Pick<Outgoing, "review" | "text">;

/** A session's open process, which takes messages until it is closed. */
export interface AgentProcess {
  /** Ends the process once its turn is over. */
  close(): void;
  /** Its events, ending after its `exit` event. */
  events: AsyncIterable<AgentEvent>;
  /** Ends the running turn through the agent's own interrupt, and keeps the process. */
  interrupt(): void;
  /** Signals the process, and the processes it started. */
  kill(signal: "SIGINT" | "SIGTERM" | "SIGKILL"): void;
  send(message: Outgoing): void;
  /**
   * Changes the effort it runs on, from its next turn on: undefined for the agent's default. A
   * runtime without it is reopened with the new effort.
   */
  setEffort?(effort: string | undefined): void;
  /** Takes back a message the agent has not read. */
  takeBack(id: string): void;
}

/**
 * The one interface every agent is reached through: a runtime, registered under a name its
 * sessions store (see `Runtimes`).
 */
export interface Adapter {
  /** The accounts the agent runs on, when it offers several: none without it. */
  readonly accounts?: Accounts;
  /**
   * The narrowest rule that allows a blocked action, passed to `open` as `allowed`: undefined when
   * no rule allows that action alone.
   */
  allowRule(denial: Denial): string | undefined;
  readonly capabilities: Capabilities;
  /** Whether the session's transcript exists, in its `account` if it has one, to be resumed. */
  hasSession(nativeId: string, account?: string): boolean;
  /** The icon of its mark, a name of the app's icon set: "uraeda:harness-claude". */
  readonly icon: string;
  /** The agent's own kind, which a benchmark's record names it by: "claude". */
  readonly kind: string;
  /** The models the agent lists, offered where a session starts: none without it. */
  models?(): Promise<ModelList>;
  /** The agent's name, for people: "Claude Code". */
  readonly name: string;
  open(options: OpenOptions): AgentProcess;
  /**
   * The message that runs `ask` through the agent's own review, when it has one: else a reviewer on
   * it is asked to review in plain words.
   */
  reviewMessage?(ask: ReviewAsk): ReviewMessage;
  /** The agent's version, or undefined when it is not available on this machine. */
  version(): Promise<string | undefined>;
}
