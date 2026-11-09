// The writes of the cache's `sessions` rows: a new session, and the fields a write may change.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { type Row, type SessionRow, toSession } from "./cache-rows.ts";

/** A new session's fields. */
export type NewSession = {
  agent: string;
  /** The effort picked, by the agent's ID: none for the agent's default. */
  effort?: string | null;
  folder: string | null;
  /** The model picked, by the agent's ID: none for the agent's default. */
  model?: string | null;
  nativeId: string;
  /** The session that started it, as a sub-session of a run: none for every other session. */
  parent?: string | null;
  repo: string;
  /** A sub-session's role in its parent's run, like `implementer`: none for every other one. */
  role?: string | null;
  /** The workflow step it starts for, like `spec`: none for a session started without one. */
  step?: string | null;
  title: string | null;
  /** The worktree it works in, when not its feature's: none for its feature's. */
  worktree?: string | null;
};

/** The session fields a write may change. */
export type SessionFields = Partial<
  Pick<
    SessionRow,
    "nativeId" | "title" | "seenAt" | "archivedAt" | "effort" | "ranModel" | "ranEffort"
  >
>;

/** The session columns a write may change, by their field. */
const sessionColumns = {
  archivedAt: "archived_at",
  effort: "effort",
  nativeId: "native_id",
  ranEffort: "ran_effort",
  ranModel: "ran_model",
  seenAt: "seen_at",
  title: "title",
} as const;

/** Inserts a new session, with a new ID, created and updated now. */
export function insertSession(db: DatabaseSync, row: NewSession): SessionRow {
  const created = new Date().toISOString();
  const inserted = db
    .prepare(
      `INSERT INTO sessions
         (id, repo, folder, agent, native_id, title, model, effort, step, parent, role, worktree,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(
      randomUUID(),
      row.repo,
      row.folder,
      row.agent,
      row.nativeId,
      row.title,
      row.model ?? null,
      row.effort ?? null,
      row.step ?? null,
      row.parent ?? null,
      row.role ?? null,
      row.worktree ?? null,
      created,
      created,
    ) as Row;
  return toSession(inserted);
}

/** Changes the session's fields that are given. */
export function writeSession(db: DatabaseSync, id: string, fields: SessionFields): void {
  const changed = (Object.keys(sessionColumns) as Array<keyof typeof sessionColumns>).filter(
    (field) => fields[field] !== undefined,
  );
  if (changed.length === 0) {
    return;
  }
  db.prepare(
    `UPDATE sessions SET ${changed.map((field) => `${sessionColumns[field]} = ?`).join(", ")}
     WHERE id = ?`,
  ).run(...changed.map((field) => fields[field] ?? null), id);
}
