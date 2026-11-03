// The turns' states, in the cache's `turns` table: their starts, their ends, and what a server
// that stopped while they ran leaves behind.
import type { DatabaseSync } from "node:sqlite";
import { type Row, type TurnRow, toTurn } from "./cache-rows.ts";
import type { TurnState } from "./events.ts";
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
 * Dismisses a failed or stopped turn, so it no longer asks for the human: false for a turn in any
 * other state, or dismissed already.
 */
export function dismiss(db: DatabaseSync, turn: number): boolean {
  const { changes } = db
    .prepare(
      `UPDATE turns SET dismissed_at = ? WHERE id = ? AND state IN ('failed', 'stopped')
         AND dismissed_at IS NULL`,
    )
    .run(now(), turn);
  return Number(changes) > 0;
}

/**
 * Marks the turns still `running` or `queued` as stopped with the reason, and returns them, when
 * `orphaned` says their session's holder, a pid or null, no longer runs them.
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
    const ended = now();
    const stop = db.prepare(
      "UPDATE turns SET state = 'stopped', reason = ?, ended_at = ? WHERE id = ? RETURNING *",
    );
    return running
      .filter(({ pid }) => orphaned(pid))
      .map(({ id }) => toTurn(stop.get(reason, ended, id) as Row))
      .sort((a, b) => a.id - b.id);
  });
}
