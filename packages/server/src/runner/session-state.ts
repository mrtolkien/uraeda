import type { Binding } from "../fate/context.ts";
import { IMAGE_REFUSALS, RUNTIME_REFUSALS } from "../limits.ts";
import type { Adapter, AgentProcess, Outgoing } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { Continuer } from "./continuer.ts";
import type { BackgroundTask, Item, Limit, Trigger, TurnActivity, TurnState } from "./events.ts";
import type { LiveSessions } from "./live-sessions.ts";
import type { Processes } from "./processes.ts";
import type { Runtimes } from "./runtimes.ts";
import type { Transcript } from "./transcript.ts";
import type { Turns } from "./turns.ts";

/** A session's process is closed after this long without a turn, and resumed by its next message. */
export const IDLE_CLOSE_MS = 15 * 60_000;
/** An idle process with a pending wakeup closes this long after it, unless the agent went on. */
export const WAKEUP_GRACE_MS = 60_000;
/**
 * A wakeup further ahead than this holds no process open: it would for days, and a timer past ~24.8
 * days fires at once (R16).
 */
export const WAKEUP_HORIZON_MS = 24 * 60 * 60_000;
/** A turn without any output for this long is stopped, and fails. */
export const WATCHDOG_MS = 30 * 60_000;
/**
 * SIGINT follows an unanswered interrupt after this long, and SIGTERM as long after SIGINT. A
 * closed process still running this long after gets SIGTERM, and SIGKILL as long after.
 */
export const TERMINATE_AFTER_MS = 10_000;
/** A tool's output, and a thought's text, are cut to this many characters. */
export const OUTPUT_LIMIT = 4000;
export { MAX_IMAGES } from "../limits.ts";

/** Why a turn stopped as the server stopped, or as the next start found it left running. */
export const SERVER_STOPPED = "Stopped: the server stopped while it ran.";

/** Why a queued turn stopped as the human took its message back: it never asks for them. */
export const TAKEN_BACK = "Taken back.";

export const REFUSALS = {
  /** A write on a feature, or a session another server holds, while its agent works. */
  working: "An agent is working on this feature. Stop it first, or wait for it.",
  /** A workflow message read for a feature whose step waits on the human. */
  human: "The feature waits on you now: there is nothing to continue.",
  noBranch: "This feature has no branch left: it is merged.",
  /** A take-back of a message the agent read. */
  read: "The agent already read it.",
  /** A message with no text. */
  blank: "The message is empty.",
  /** An allow of a blocked action no rule matches alone, as a command with a `*`. */
  noRule: "No allow rule can match only this action.",
  /** An "Allow all" with no blocked action of the latest turn that has a rule. */
  nothingToAllow: "No blocked action to allow.",
  ...IMAGE_REFUSALS,
  /** An image ID with no file in the data folder: removed, or never uploaded. */
  imageGone: "This image is gone: add it again.",
  ...RUNTIME_REFUSALS,
  /** A session moved, or a change moved or dropped, while its agent works. */
  agentWorking: "The agent is working",
  /** A message to a session of a change or a feature while another of its sessions works. */
  otherWorking: (kind: string) => `Another session of this ${kind} is working`,
  /** A dismiss of a turn that runs or waits: only a failed or stopped run is dismissed. */
  stillRunning: "The run is still going.",
  /** A dismiss of a queued message taken back: it never ran, and the session's status skips it. */
  takenBack: "This message was taken back: it never ran.",
  /** A message, a run, or a new session of a dropped change or feature: its sessions are archived. */
  dropped: "This change or feature was dropped: its branch stays.",
};

/** Whether the session belongs to a dropped change or feature: a session with a folder archived. */
export const ofDropped = (row: { archivedAt: string | null; folder: string | null }) =>
  row.folder !== null && row.archivedAt !== null;

/** The line of a workflow message sent once it no longer applied: the feature waits on the human. */
export const SENT_AS_CHAT = "Sent as a message: the feature now waits on you.";

/** The line of a workflow message sent once it no longer applied, at another step. */
export const SENT_AS_CHAT_MOVED_ON = "Sent as a message: the feature moved on to another step.";

/** The line of a comments message sent without a pull request to address. */
export const SENT_AS_CHAT_NO_PULL_REQUEST = "Sent as a message: no pull request is open.";

/** The line a turn shows when its session's transcript was gone, and a new one started. */
export const REPLACED = "Started a new session: the previous one is gone.";

/**
 * The line a turn showed when a fresh run started a new agent session in its session: a fresh run
 * now starts a new session, but earlier turns keep the line.
 */
export const FRESH =
  "Started a new session for this run: the agent reads the repository, not the turns above.";

/** The line a turn shows when its agent started a new agent session in its process: `/clear`. */
export const CLEARED = "Started a new session: the agent cleared the turns above.";

/** The line a turn shows when it reopened: its agent went on after it ended. */
export const RESUMED = "The agent went on by itself: a background task reported back.";

/**
 * What changed: the agent's availability, or a session, with the turn and its new state, or its
 * state still, `dismissed`, as the human dismissed it: it did not end then.
 */
export type SessionChange =
  | { agent: true }
  | {
      dismissed?: true;
      folder: string | null;
      repo: string;
      session: string;
      state?: TurnState;
      turn?: number;
    };

export type Timer = ReturnType<typeof setTimeout>;
export type Message = Extract<Item, { kind: "message" }>;
export type Tool = Extract<Item, { kind: "tool" }>;

/** How a turn ends: its state, and why. */
export type TurnEnd = { reason?: string; state: TurnState };

/** A session's open process. */
export type Proc = {
  /**
   * Opened without resume, until its first `init`: the agent session ID that init reports is the
   * session's own, as Codex picks a thread's, not a `/clear`.
   */
  adopts: boolean;
  agent: AgentProcess;
  /**
   * Its background tasks still running, by their tool calls, sub-agents and commands: a turn does
   * not end, nor the process close, before they report back.
   */
  background: Map<string, BackgroundTask["kind"]>;
  /** Closed by the idle timer, an init's problem, or "Allow and retry": no message goes to it. */
  closing: boolean;
  cwd: string;
  /** Resolves once its events are read to its exit. */
  done: Promise<void>;
  /**
   * The effort it runs on, by the agent's ID, null for the agent's default: what it opened with,
   * or its last `setEffort`.
   */
  effort: string | null;
  /**
   * The turn that last ended on it, which reopens when the agent goes on by itself after it ended:
   * a background shell or sub-agent reported back.
   */
  ended?: { first: string; id: number };
  /** The name of the runtime it runs on: its session's stored `agent`. */
  kind: string;
  /** The line of the new agent session it started, until a turn on it records it. */
  line?: string;
  /** The runtime it runs on, kept for its whole life, even once the runtime is unregistered. */
  runtime: Adapter;
  /** SIGTERM, then SIGKILL, for a closed process that does not exit. */
  terminate: Array<Timer>;
  /**
   * The latest one-shot wakeup the agent set, in epoch milliseconds: the idle timer waits a minute
   * past it, for the agent to go on by itself.
   */
  wakeup?: number;
};

/** The turn running on a session's process. */
export type Running = {
  /** What it does now, which the line at its end says, and since when nothing new showed. */
  activity: TurnActivity;
  /** The ID of the message that started it. */
  first: string;
  id: number;
  /**
   * The usage limit that refused it, the last one reported (R11): it counts only when the turn
   * fails.
   */
  limit?: Limit;
  /** Its reply ended, and it waits for its background sub-agents to report back. */
  replied?: boolean;
  skipped?: { count: number; seq: number };
  /** How the turn ends once it was halted: by Stop, the watchdog, its plugin, or the server. */
  stop?: TurnEnd;
  terminate: Array<Timer>;
  /** The text block being streamed. */
  text?: { seq: number; text: string };
  /**
   * When the main agent's current thinking block started, in epoch milliseconds: none once its
   * whole thought, a text, or a tool call follows.
   */
  thinking?: number;
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

/**
 * A turn waiting for the running one to end, or for another session of its change or feature: its
 * message is written when it starts. A workflow run's `workflow`, its trigger and the step its
 * message was read at, is checked again then: one that no longer applies starts as a chat.
 */
export type Queued = {
  id: number;
  message: Outgoing;
  workflow?: { step?: string; trigger: Trigger };
};

/** A message this server sent, or will send, and where its item is. */
export type Sent = { item: Message; seq: number; turn: number; written: boolean };

/** What this server keeps of a session while it is used. */
export type Live = {
  /** The sends and turn starts waiting or running, which keep it in memory. */
  calls: number;
  folder: string | null;
  /**
   * While the continuer decides the continue of a turn that ended, the session's changes held, to
   * publish once it decided: read before, the run would ask (SC-003).
   */
  held?: { changes: Array<[number | undefined, TurnState | undefined]>; deciding: number };
  id: string;
  idle?: Timer;
  /** Sends and turn starts, one after another. */
  lock: Promise<unknown>;
  messages: Map<string, Sent>;
  proc?: Proc;
  queue: Array<Queued>;
  repo: string;
  /** A turn is starting: its process opens. It works, for the other sessions of its folder. */
  starting?: boolean;
  turn?: Running;
};

/**
 * What the parts of the session manager share: its runtimes, cache, and binding, how it reports a
 * change, and each other.
 */
export type SessionContext = {
  /** Reports a change of the account's usage or the agent's availability. */
  agentChanged: () => void;
  binding: Binding;
  cache: SessionCache;
  /** Reports a change of the session, with its turn and that turn's new state. */
  changed: (live: Live, turn?: number, state?: TurnState) => void;
  /** Their automatic continues: decided as turns end, armed, cancelled, and sent. */
  continuer: Continuer;
  /** The sessions kept in memory. */
  live: LiveSessions;
  /** Their processes: opened, closed, and read. */
  processes: Processes;
  /** The runtimes sessions run on, each found by the session's stored `agent`. */
  runtimes: Runtimes;
  /** Their events, recorded as items. */
  transcript: Transcript;
  /** Their turns: started, queued, halted, and ended. */
  turns: Turns;
};

/** Whether the process is open, and waits for a wakeup the agent set: it goes on by itself then. */
export function wakeupPending(proc: Proc | undefined): boolean {
  return proc !== undefined && !proc.closing && (proc.wakeup ?? 0) > Date.now();
}

export const refused = (text: string) => new Error(`refused: ${text}`);

/** The session's row, which the cache must hold. */
export function rowOf(cache: SessionCache, live: Live): SessionRow {
  const row = cache.session(live.id);
  if (!row) {
    throw new Error(`no session ${live.id}`);
  }
  return row;
}

/**
 * The runtime the session runs on: its process's while it has one, else its stored `agent`'s, when
 * that runtime is registered.
 */
export function runtimeOf(context: SessionContext, live: Live): Adapter | undefined {
  return live.proc?.runtime ?? context.runtimes.get(rowOf(context.cache, live).agent);
}

/** How many of a process's background tasks are commands, not sub-agents. */
export function commandCount(background: Proc["background"] | undefined): number {
  return [...(background?.values() ?? [])].filter((kind) => kind === "command").length;
}
