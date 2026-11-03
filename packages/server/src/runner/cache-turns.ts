// The turns' states, in the cache's `turns` table: their starts, their ends, what a server that
// stopped while they ran leaves behind, and the continues that wait for their time.
import type { DatabaseSync } from "node:sqlite";
import { type Row, type TurnRow, toTurn } from "./cache-rows.ts";
import type { ContinueReason, TurnState } from "./events.ts";
import { transaction } from "./migrations.ts";

const now = () => new Date().toISOString();

/** Records a change of the session's turns. */
export function touch(db: DatabaseSync, sessionId: string, at: string): void {
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(at, sessionId);
}

/** Starts a queued turn. */
export function startTurn(db: DatabaseSync, id: number): void {
  transaction(db, () => {
    const at = now();
    const row = db
      .prepare(
        "UPDATE turns SET state = 'running', started_at = ? WHERE id = ? RETURNING session_id",
      )
      .get(at, id) as { session_id: string } | undefined;
    if (row) {
      touch(db, row.session_id, at);
    }
  });
}

/** Makes an ended turn run again, as its agent went on after it ended. */
export function reopenTurn(db: DatabaseSync, id: number): void {
  transaction(db, () => {
    const row = db
      .prepare(
        `UPDATE turns SET state = 'running', reason = NULL, ended_at = NULL WHERE id = ?
         RETURNING session_id`,
      )
      .get(id) as { session_id: string } | undefined;
    if (row) {
      touch(db, row.session_id, now());
    }
  });
}

/** Ends a turn. */
export function endTurn(db: DatabaseSync, id: number, end: { reason?: string; state: TurnState }) {
  transaction(db, () => {
    const at = now();
    const row = db
      .prepare(
        `UPDATE turns SET state = ?, reason = ?, ended_at = ? WHERE id = ? RETURNING session_id`,
      )
      .get(end.state, end.reason ?? null, at, id) as { session_id: string } | undefined;
    if (row) {
      touch(db, row.session_id, at);
    }
  });
}

/**
 * Dismisses a failed or stopped turn, so it no longer asks for the human, nor continues: false for
 * a turn in any other state, or dismissed already.
 */
export function dismiss(db: DatabaseSync, turn: number): boolean {
  const { changes } = db
    .prepare(
      `UPDATE turns SET dismissed_at = ?, continue_at = NULL, continue_reason = NULL
       WHERE id = ? AND state IN ('failed', 'stopped') AND dismissed_at IS NULL`,
    )
    .run(now(), turn);
  return Number(changes) > 0;
}

/**
 * Marks the turns still `running` or `queued` as stopped with the reason, and returns them, when
 * `orphaned` says their session's holder, a pid or null, no longer runs them. Each ends at its last
 * activity, the later of its latest item and its start (a queued turn's message is kept before it
 * starts), else now: not now when it has either, as a crash's server may start hours later.
 */
export function interrupted(
  db: DatabaseSync,
  reason: string,
  orphaned: (pid: number | null) => boolean,
): Array<TurnRow> {
  return transaction(db, () => {
    const running = db
      .prepare(
        `SELECT t.id, s.pid FROM turns t JOIN sessions s ON s.id = t.session_id
         WHERE t.state IN ('running', 'queued')`,
      )
      .all() as Array<{ id: number; pid: number | null }>;
    const stop = db.prepare(
      `WITH last AS (SELECT at FROM items WHERE turn_id = ?2 ORDER BY seq DESC LIMIT 1)
       UPDATE turns SET state = 'stopped', reason = ?1, ended_at = COALESCE(
         MAX((SELECT at FROM last), started_at), (SELECT at FROM last), started_at, ?3)
       WHERE id = ?2 RETURNING *`,
    );
    return running
      .filter(({ pid }) => orphaned(pid))
      .map(({ id }) => toTurn(stop.get(reason, id, now()) as Row))
      .sort((a, b) => a.id - b.id);
  });
}

/** Sets when the turn's run continues by itself, and why. */
export function scheduleContinue(db: DatabaseSync, turn: number, at: number, why: ContinueReason) {
  db.prepare("UPDATE turns SET continue_at = ?, continue_reason = ? WHERE id = ?").run(
    at,
    why,
    turn,
  );
}

/** Records why the turn's run would have continued, past the cap: none waits. */
export function markCapped(db: DatabaseSync, turn: number, why: ContinueReason): void {
  db.prepare("UPDATE turns SET continue_at = NULL, continue_reason = ? WHERE id = ?").run(
    why,
    turn,
  );
}

/**
 * Claims the turn's waiting continue, and returns the turn, its reason kept: undefined when none
 * waited, or another server or timer claimed it first. The check and the write are one statement,
 * in one transaction, so a continue is claimed once.
 */
export function takeContinue(db: DatabaseSync, turn: number): TurnRow | undefined {
  return transaction(db, () => {
    const row = db
      .prepare(
        `UPDATE turns SET continue_at = NULL WHERE id = ? AND continue_at IS NOT NULL
         RETURNING *`,
      )
      .get(turn) as Row | undefined;
    return row ? toTurn(row) : undefined;
  });
}

/**
 * Clears the turn's continue, and its reason, and returns whether a continue waited. With
 * `stopped`, a waiting continue's turn becomes stopped without a reason, as the human's Stop does.
 */
export function cancelContinue(db: DatabaseSync, turn: number, stopped: boolean): boolean {
  return transaction(db, () => {
    const waited = db
      .prepare("SELECT 1 FROM turns WHERE id = ? AND continue_at IS NOT NULL")
      .get(turn);
    db.prepare("UPDATE turns SET continue_at = NULL, continue_reason = NULL WHERE id = ?").run(
      turn,
    );
    if (waited && stopped) {
      db.prepare("UPDATE turns SET state = 'stopped', reason = NULL WHERE id = ?").run(turn);
    }
    return waited !== undefined;
  });
}

/** Clears every waiting continue of the reason, as its setting turned off, and returns the turns. */
export function dropContinues(db: DatabaseSync, why: ContinueReason): Array<TurnRow> {
  const rows = db
    .prepare(
      `UPDATE turns SET continue_at = NULL, continue_reason = NULL
       WHERE continue_reason = ? AND continue_at IS NOT NULL RETURNING *`,
    )
    .all(why) as Array<Row>;
  return rows.map(toTurn).sort((a, b) => a.id - b.id);
}

/** Every turn whose continue waits, the soonest first. */
export function pendingContinues(db: DatabaseSync): Array<TurnRow> {
  const rows = db
    .prepare("SELECT * FROM turns WHERE continue_at IS NOT NULL ORDER BY continue_at, id")
    .all() as Array<Row>;
  return rows.map(toTurn);
}

/** The latest time a limit's continue waits for, at or after `from`. */
export function latestLimitContinue(db: DatabaseSync, from: number): number | undefined {
  const { at } = db
    .prepare(
      "SELECT MAX(continue_at) AS at FROM turns WHERE continue_reason = 'limit' AND continue_at >= ?",
    )
    .get(from) as { at: number | null };
  return at ?? undefined;
}

/** Counts an automatic continue of the session, and returns its continues in a row. */
export function addContinue(db: DatabaseSync, session: string): number {
  const { count } = db
    .prepare(
      `UPDATE sessions SET automatic_continues = automatic_continues + 1 WHERE id = ?
       RETURNING automatic_continues AS count`,
    )
    .get(session) as { count: number };
  return count;
}

/** Sets the session's continues in a row back to 0: a commit, or the human's message. */
export function resetContinues(db: DatabaseSync, session: string): void {
  db.prepare("UPDATE sessions SET automatic_continues = 0 WHERE id = ?").run(session);
}
