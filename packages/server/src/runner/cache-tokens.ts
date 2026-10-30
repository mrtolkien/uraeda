// The tokens of the turns, in the cache's `turns` table: each turn's own, and the sum of the agent
// session the session works in now.
import type { DatabaseSync } from "node:sqlite";
import type { TokenCounts } from "./events.ts";
import { CLEARED, FRESH, REPLACED } from "./session-state.ts";

/** Adds the counts to the turn's own, a null count read as 0. */
export function addTurnTokens(db: DatabaseSync, id: number, counts: TokenCounts): void {
  db.prepare(
    `UPDATE turns SET input_tokens = COALESCE(input_tokens, 0) + ?,
       cache_write_tokens = COALESCE(cache_write_tokens, 0) + ?,
       cache_read_tokens = COALESCE(cache_read_tokens, 0) + ?,
       output_tokens = COALESCE(output_tokens, 0) + ?
     WHERE id = ?`,
  ).run(counts.input, counts.cacheWrite, counts.cacheRead, counts.output, id);
}

/**
 * The tokens of the session's current agent session: the sum of its turns since the latest that
 * started a new one, saying so in a `system` item, that turn included, or of all its turns.
 */
export function agentSessionTokens(db: DatabaseSync, sessionId: string): TokenCounts {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(input_tokens), 0) AS input,
         COALESCE(SUM(cache_write_tokens), 0) AS cacheWrite,
         COALESCE(SUM(cache_read_tokens), 0) AS cacheRead,
         COALESCE(SUM(output_tokens), 0) AS output
       FROM turns WHERE session_id = ?1 AND id >= COALESCE(
         (SELECT MAX(i.turn_id) FROM items i JOIN turns t ON t.id = i.turn_id
          WHERE t.session_id = ?1 AND i.kind = 'system'
            AND json_extract(i.data, '$.text') IN (?2, ?3, ?4)), 0)`,
    )
    .get(sessionId, FRESH, REPLACED, CLEARED) as TokenCounts;
  return { ...row };
}
