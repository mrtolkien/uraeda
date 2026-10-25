// What a session's items say of its work, read in SQL over the cache's `items` table, the JSON
// fields with `json_extract`, so no page of items is read into memory.
import type { DatabaseSync } from "node:sqlite";
import type { ToolKind } from "./events.ts";

/** A file a session edited, by its path, and its count of completed edits. */
export type EditedFile = { edits: number; path: string };

/** A sub-agent working in a running turn, and its own tool calls so far. */
export type SubagentRow = {
  /** The tool calls whose parent it is, the sub-agents it started included. */
  calls: number;
  description: string;
  /** Its tool call's ID. */
  id: string;
  /** The last of its tool calls, null before the first. */
  latest: { target: string | null; toolKind: ToolKind } | null;
  /** The sub-agent that started it, null when the main agent did. */
  parent: string | null;
  /** When its tool call was cached, in ISO 8601. */
  startedAt: string;
};

/**
 * The targets of the session's completed edit calls, of every turn and sub-agent, in the order of
 * their first edit. A failed, cancelled, or running edit does not count.
 */
export function editedFiles(db: DatabaseSync, sessionId: string): Array<EditedFile> {
  const rows = db
    .prepare(
      `SELECT path, COUNT(*) AS edits FROM (
         SELECT json_extract(i.data, '$.target') AS path,
           ROW_NUMBER() OVER (ORDER BY i.turn_id, i.seq) AS position
         FROM items i JOIN turns t ON t.id = i.turn_id
         WHERE t.session_id = ? AND i.kind = 'tool'
           AND json_extract(i.data, '$.toolKind') = 'edit'
           AND json_extract(i.data, '$.status') = 'completed')
       WHERE path IS NOT NULL
       GROUP BY path ORDER BY MIN(position)`,
    )
    .all(sessionId) as Array<EditedFile>;
  return rows.map(({ edits, path }) => ({ edits, path }));
}

/**
 * The turn's sub-agents still in progress, in the order they started, with their count of tool
 * calls and the latest of them: the calls of a sub-agent they started are its own.
 */
export function subagentsOf(db: DatabaseSync, turnId: number): Array<SubagentRow> {
  const rows = db
    .prepare(
      `SELECT s.at AS startedAt,
         json_extract(s.data, '$.id') AS id,
         json_extract(s.data, '$.subagent.description') AS description,
         json_extract(s.data, '$.parent') AS parent,
         (SELECT COUNT(*) FROM items c WHERE c.turn_id = s.turn_id AND c.kind = 'tool'
            AND json_extract(c.data, '$.parent') = json_extract(s.data, '$.id')) AS calls,
         (SELECT json_object('target', json_extract(c.data, '$.target'),
                   'toolKind', json_extract(c.data, '$.toolKind'))
            FROM items c WHERE c.turn_id = s.turn_id AND c.kind = 'tool'
              AND json_extract(c.data, '$.parent') = json_extract(s.data, '$.id')
            ORDER BY c.seq DESC LIMIT 1) AS latest
       FROM items s
       WHERE s.turn_id = ? AND s.kind = 'tool'
         AND json_extract(s.data, '$.subagent') IS NOT NULL
         AND json_extract(s.data, '$.status') = 'in_progress'
       ORDER BY s.seq`,
    )
    .all(turnId) as Array<{
    calls: number;
    description: string | null;
    id: string;
    latest: string | null;
    parent: string | null;
    startedAt: string;
  }>;
  return rows.map((row) => ({
    calls: row.calls,
    description: row.description ?? "",
    id: row.id,
    latest: row.latest === null ? null : (JSON.parse(row.latest) as SubagentRow["latest"]),
    parent: row.parent,
    startedAt: row.startedAt,
  }));
}
