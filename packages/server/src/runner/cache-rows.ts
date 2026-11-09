import type { ContinueReason, TokenCounts, Trigger, TurnKind, TurnState } from "./events.ts";

/** A session, as the cache keeps it. */
export type SessionRow = {
  /** The agent's kind: `claude`. */
  agent: string;
  archivedAt: string | null;
  /** The automatic continues in a row, set back to 0 by a commit or the human's message. */
  automaticContinues: number;
  createdAt: string;
  /** The effort picked, by the agent's ID, or changed since: null for the agent's default. */
  effort: string | null;
  /** The change's or feature's folder, set once, null for a session without one. */
  folder: string | null;
  /** Uraeda's own ID, a UUID. */
  id: string;
  /** The model picked when it started, by the agent's ID: null for the agent's default. */
  model: string | null;
  /**
   * The agent's own session ID: for an agent that picks its own, as Codex, the one it gave at the
   * session's first start.
   */
  nativeId: string;
  /** The server process that holds the session's agent process, null when closed. */
  pid: number | null;
  /** The effort the agent last reported running on, by its name for people: null for none. */
  ranEffort: string | null;
  /** The model the agent last reported running on, by its name: null before it reports one. */
  ranModel: string | null;
  /** The repository's main checkout. */
  repo: string;
  /** When the human last saw it ended. */
  seenAt: string | null;
  /** Null for a feature's session: its feature's name shows. */
  title: string | null;
  /** The last turn's start or end. */
  updatedAt: string;
};

/** A turn, as the cache keeps it: one message until the agent settles. */
export type TurnRow = {
  /** Allow turns: the allow rule. */
  allowed: string | null;
  /** A catch-up's commit of the default branch, which it started for: null for any other turn. */
  caughtUpTo: string | null;
  /** When Uraeda continues the run by itself, epoch ms, null when no continue waits. */
  continueAt: number | null;
  /** Why the run continues, or why it would have past the cap: kept once a continue is claimed. */
  continueReason: ContinueReason | null;
  /** When the human dismissed its failure or its stop, null while it still asks for them. */
  dismissedAt: string | null;
  endedAt: string | null;
  id: number;
  kind: TurnKind;
  /** Why it failed or stopped, in the UI's words. */
  reason: string | null;
  sessionId: string;
  startedAt: string | null;
  state: TurnState;
  /** Workflow turns: the core's step when it started. */
  step: string | null;
  /** The tokens of its own work, null when the agent reported none. */
  tokens: TokenCounts | null;
  /** Workflow turns: what started it. */
  trigger: Trigger | null;
};

/** A row as SQLite returns it. */
export type Row = Record<string, string | number | null>;

export const toSession = (row: Row): SessionRow => ({
  agent: String(row.agent),
  archivedAt: row.archived_at as string | null,
  automaticContinues: Number(row.automatic_continues),
  createdAt: String(row.created_at),
  effort: row.effort as string | null,
  folder: row.folder as string | null,
  id: String(row.id),
  model: row.model as string | null,
  nativeId: String(row.native_id),
  pid: row.pid as number | null,
  ranEffort: row.ran_effort as string | null,
  ranModel: row.ran_model as string | null,
  repo: String(row.repo),
  seenAt: row.seen_at as string | null,
  title: row.title as string | null,
  updatedAt: String(row.updated_at),
});

export const toTurn = (row: Row): TurnRow => ({
  allowed: row.allowed as string | null,
  caughtUpTo: (row.caught_up_to ?? null) as string | null,
  continueAt: row.continue_at as number | null,
  continueReason: row.continue_reason as ContinueReason | null,
  dismissedAt: row.dismissed_at as string | null,
  endedAt: row.ended_at as string | null,
  id: Number(row.id),
  kind: row.kind as TurnKind,
  reason: row.reason as string | null,
  sessionId: String(row.session_id),
  startedAt: row.started_at as string | null,
  state: row.state as TurnState,
  step: row.step as string | null,
  tokens: toTokens(row),
  trigger: row.trigger as Trigger | null,
});

/** A turn's token counts, null when all four are: a null count alone reads as 0. */
function toTokens(row: Row): TokenCounts | null {
  const counts = [
    row.cache_read_tokens,
    row.cache_write_tokens,
    row.input_tokens,
    row.output_tokens,
  ];
  if (counts.every((count) => count === null || count === undefined)) {
    return null;
  }
  const [cacheRead, cacheWrite, input, output] = counts.map((count) => Number(count ?? 0));
  return { cacheRead: cacheRead!, cacheWrite: cacheWrite!, input: input!, output: output! };
}
