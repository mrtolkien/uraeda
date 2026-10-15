import type { Binding } from "../fate/context.ts";
import { IMAGE_REFUSALS } from "../limits.ts";
import type { Adapter, AgentProcess, Outgoing } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { Item, TurnActivity, TurnState } from "./events.ts";
import type { LiveSessions } from "./live-sessions.ts";
import type { Processes } from "./processes.ts";
import type { Transcript } from "./transcript.ts";
import type { Turns } from "./turns.ts";

/** A session's process is closed after this long without a turn, and resumed by its next message. */
export const IDLE_CLOSE_MS = 15 * 60_000;
/** A turn without any output for this long is stopped, and fails. */
export const WATCHDOG_MS = 30 * 60_000;
/**
 * SIGINT follows an unanswered interrupt after this long, and SIGTERM as long after SIGINT. A
 * closed process still running this long after gets SIGTERM, and SIGKILL as long after.
 */
export const TERMINATE_AFTER_MS = 10_000;
/** A tool's output is cut to this many characters. */
export const OUTPUT_LIMIT = 4000;
export { MAX_IMAGES } from "../limits.ts";

export const REFUSALS = {
  /** A write on a feature, or a session another server holds, while its agent works. */
  working: "An agent is working on this feature. Stop it first, or wait for it.",
  /** A workflow message on a feature whose step waits on the human. */
  human: "The feature waits on you now: there is nothing to continue.",
  noBranch: "This feature has no branch yet: commit its proposal first.",
  /** A take-back of a message the agent read. */
  read: "The agent already read it.",
  /** A message with no text. */
  blank: "The message is empty.",
  /** An allow of a blocked action no rule matches alone, as a command with a `*`. */
  noRule: "No allow rule can match only this action.",
  ...IMAGE_REFUSALS,
  /** An image ID with no file in the data folder: removed, or never uploaded. */
  imageGone: "This image is gone: add it again.",
  unavailable: (name: string) => `${name} is not available on this machine.`,
};

/** The line a turn shows when its session's transcript was gone, and a new one started. */
export const REPLACED = "Started a new session: the previous one is gone.";

/** The line a turn shows when it reopened: its agent went on after it ended. */
export const RESUMED = "The agent went on by itself: a background task reported back.";

/** What changed: the agent's availability, or a session, with the turn and its new state. */
export type SessionChange =
  | { agent: true }
  | { folder: string | null; repo: string; session: string; state?: TurnState; turn?: number };

export type Timer = ReturnType<typeof setTimeout>;
export type Message = Extract<Item, { kind: "message" }>;
export type Tool = Extract<Item, { kind: "tool" }>;

/** How a turn ends: its state, and why. */
export type TurnEnd = { reason?: string; state: TurnState };

/** A session's open process. */
export type Proc = {
  agent: AgentProcess;
  /**
   * The tool calls of its background sub-agents still running: a turn does not end before they
   * report back.
   */
  background: Set<string>;
  /** Closed by the idle timer, a plugin error, or "Allow and retry": no message goes to it. */
  closing: boolean;
  cwd: string;
  /** Resolves once its events are read to its exit. */
  done: Promise<void>;
  /**
   * The turn that last ended on it, which reopens when the agent goes on by itself after it ended:
   * a background shell or sub-agent reported back.
   */
  ended?: { first: string; id: number };
  /** SIGTERM, then SIGKILL, for a closed process that does not exit. */
  terminate: Array<Timer>;
};

/** The turn running on a session's process. */
export type Running = {
  /** What it does now, which the line at its end says, and since when nothing new showed. */
  activity: TurnActivity;
  /** The ID of the message that started it. */
  first: string;
  id: number;
  /** Its reply ended, and it waits for its background sub-agents to report back. */
  replied?: boolean;
  skipped?: { count: number; seq: number };
  /** How the turn ends once it was halted: by Stop, the watchdog, its plugin, or the server. */
  stop?: TurnEnd;
  terminate: Array<Timer>;
  /** The text block being streamed. */
  text?: { seq: number; text: string };
  /**
   * Its tool calls not ended, or whose background sub-agent still runs: `ended` holds their
   * result until it ends.
   */
  tools: Map<
    string,
    { at: number; ended?: { isError: boolean; output: string }; item: Tool; seq: number }
  >;
  watchdog?: Timer;
};

/** A turn waiting for the running one to end: its message is written when it starts. */
export type Queued = { id: number; message: Outgoing };

/** A message this server sent, or will send, and where its item is. */
export type Sent = { item: Message; seq: number; turn: number; written: boolean };

/** What this server keeps of a session while it is used. */
export type Live = {
  /** The sends and turn starts waiting or running, which keep it in memory. */
  calls: number;
  folder: string | null;
  id: string;
  idle?: Timer;
  /** Sends and turn starts, one after another. */
  lock: Promise<unknown>;
  messages: Map<string, Sent>;
  proc?: Proc;
  queue: Array<Queued>;
  repo: string;
  turn?: Running;
};

/**
 * What the parts of the session manager share: its agent, cache, and binding, how it reports a
 * change, and each other.
 */
export type SessionContext = {
  adapter: Adapter;
  /** Reports a change of the account's usage or the agent's availability. */
  agentChanged: () => void;
  binding: Binding;
  cache: SessionCache;
  /** Reports a change of the session, with its turn and that turn's new state. */
  changed: (live: Live, turn?: number, state?: TurnState) => void;
  /** The sessions kept in memory. */
  live: LiveSessions;
  /** Their processes: opened, closed, and read. */
  processes: Processes;
  /** Their events, recorded as items. */
  transcript: Transcript;
  /** Their turns: started, queued, halted, and ended. */
  turns: Turns;
};

export const refused = (text: string) => new Error(`refused: ${text}`);

/** The session's row, which the cache must hold. */
export function rowOf(cache: SessionCache, live: Live): SessionRow {
  const row = cache.session(live.id);
  if (!row) {
    throw new Error(`no session ${live.id}`);
  }
  return row;
}
