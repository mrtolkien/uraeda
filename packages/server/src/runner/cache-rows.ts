import type { TokenCounts, Trigger, TurnKind, TurnState } from "./events.ts";

/** A session, as the cache keeps it. */
export type SessionRow = {
  /** The agent's kind: `claude`. */
  agent: string;
  archivedAt: string | null;
  createdAt: string;
  /** The feature's folder, null for a chat. */
  folder: string | null;
  /** Uraeda's own ID, a UUID. */
  id: string;
  /** The agent's own session ID. */
  nativeId: string;
  /** The server process that holds the session's agent process, null when closed. */
  pid: number | null;
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
  createdAt: String(row.created_at),
  folder: row.folder as string | null,
  id: String(row.id),
  nativeId: String(row.native_id),
  pid: row.pid as number | null,
  repo: String(row.repo),
  seenAt: row.seen_at as string | null,
  title: row.title as string | null,
  updatedAt: String(row.updated_at),
});

export const toTurn = (row: Row): TurnRow => ({
  allowed: row.allowed as string | null,
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
