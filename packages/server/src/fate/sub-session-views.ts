// A session's sub-sessions, as its record lists them (US6 of the run options): every sub-agent of a
// workflow run is a session Uraeda started, its implementer of a task or a reviewer, read here from
// the cache with its state, its time, and its usage, and its model and effort by their names for
// people, from its agent's list.
import type { SessionRow } from "../runner/cache.ts";
import type { Role } from "../runner/sub-sessions.ts";
import type { RepoContext } from "./context.ts";
import { latestOf } from "./session-reads.ts";
import { featureTokens } from "./tokens.ts";

/** Where a sub-session stands, from its latest turn: at work, done, failed, or stopped. */
export type SubSessionState = "working" | "done" | "failed" | "stopped";

/** A sub-session, as its parent's views draw it. */
export type SubSessionRecord = {
  /** What it works on: its task, "Task 4: Next due date on completion", or what it reviews. */
  about: string;
  /** Its agent's runtime, `claude` or `codex`. */
  agent: string;
  /** Its effort's name for people, "High": null on the model's default. */
  effort: string | null;
  /** When its latest turn ended: null while it works. */
  endedAt: string | null;
  id: string;
  /** Its model's name for people, "Sonnet 5.5": "Default" on the agent's own, before it said. */
  model: string;
  /** The session that started it. */
  parent: string;
  role: Role;
  startedAt: string;
  state: SubSessionState;
  /** Its tokens, fresh input and cache writes, and output: null before its agent reported any. */
  usage: { input: number; output: number } | null;
};

/** A session's role as stored, a sub-session's: none for every other session. */
const roleOf = (row: SessionRow): Role | null =>
  row.role === null ? null : row.role === "reviewer" ? "reviewer" : "implementer";

/** A sub-session's model and effort by their names for people, from its agent's list. */
function namesOf(ctx: RepoContext, row: SessionRow) {
  const listed = ctx.sessions.runtimes.models(row.agent)?.models ?? [];
  const model = listed.find((each) => each.id === row.model);
  const effort = model?.efforts.find((each) => each.id === row.effort);
  return {
    effort: effort?.name ?? row.ranEffort ?? row.effort,
    model: model?.name ?? row.ranModel ?? row.model ?? "Default",
  };
}

/** The record of the sub-session `row`: a session without a turn yet is at work. */
export function subSessionRecord(ctx: RepoContext, row: SessionRow): SubSessionRecord {
  const turns = ctx.sessions.cache.turns(row.id);
  const { latest } = latestOf(turns);
  const state: SubSessionState =
    latest === undefined || latest.state === "running" || latest.state === "queued"
      ? "working"
      : latest.state;
  const tokens = featureTokens(turns);
  return {
    about: row.title ?? "",
    agent: row.agent,
    ...namesOf(ctx, row),
    endedAt: state === "working" ? null : (latest?.endedAt ?? null),
    id: row.id,
    parent: row.parent ?? "",
    role: roleOf(row) ?? "implementer",
    startedAt: row.createdAt,
    state,
    usage: tokens && { input: tokens.input, output: tokens.output },
  };
}

/** The sub-sessions the session `row` started, the first started first, and its own place. */
export function subSessionFields(ctx: RepoContext, row: SessionRow) {
  return {
    parent: row.parent,
    role: roleOf(row),
    subSessions: ctx.sessions.cache.subSessionsOf(row.id).map((sub) => subSessionRecord(ctx, sub)),
  };
}
