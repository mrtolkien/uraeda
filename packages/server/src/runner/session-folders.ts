import { randomUUID } from "node:crypto";
import type { SessionRow } from "./cache.ts";
import { transaction } from "./migrations.ts";
import { newSessionPick, type Picked, type SessionPick } from "./picks.ts";
import {
  ofDropped,
  REFUSALS,
  refused,
  type SessionChange,
  type SessionContext,
} from "./session-state.ts";

/**
 * The sessions of changes and features, and chats, made and moved: each call takes the main
 * checkout `root`, which `Sessions.mainRoot` resolved, and reports a session it changes without
 * keeping it in memory to `onChange`.
 */

type OnChange = (change: SessionChange) => void;

const now = () => new Date().toISOString();

/**
 * What a new session runs on: `Picked` as given, or what a `SessionPick` says, as `newSessionPick`
 * rules it, refused with no runtime on, or a model or an effort its runtime does not offer.
 */
export type NewPick = SessionPick | (() => Picked);

/** A new session in `root`, of `folder` or a chat, on `pick`. */
function create(
  context: SessionContext,
  root: string,
  folder: string | null,
  pick?: NewPick,
): SessionRow {
  return context.cache.createSession({
    ...(typeof pick === "function" ? pick() : newSessionPick(context.runtimes, root, pick)),
    folder,
    nativeId: randomUUID(),
    repo: root,
    title: null,
  });
}

/** Refuses a change or a feature dropped: its sessions are all archived. */
function refuseDropped(latest: SessionRow | undefined) {
  if (latest && ofDropped(latest)) {
    throw refused(REFUSALS.dropped);
  }
}

/**
 * The latest session of a change or a feature, created on `pick` when it has none: refused for a
 * dropped one, whose sessions are all archived, so its runs never recreate its worktree.
 */
export function featureSession(
  context: SessionContext,
  root: string,
  folder: string,
  pick?: NewPick,
): SessionRow {
  const { cache } = context;
  // One transaction: another server cannot create a first session between the read and the write.
  return transaction(cache.db, () => {
    const latest = cache.latestSession(root, folder);
    refuseDropped(latest);
    return latest ?? create(context, root, folder, pick);
  });
}

/**
 * A new session of a change or a feature, on `pick`, which becomes its latest: its runs go to it.
 * Its feature's open pages are sent it. Refused for a dropped one.
 */
export function newSession(
  context: SessionContext,
  onChange: OnChange,
  root: string,
  { folder, pick }: { folder: string; pick?: NewPick },
): SessionRow {
  refuseDropped(context.cache.latestSession(root, folder));
  const row = create(context, root, folder, pick);
  onChange({ folder, repo: root, session: row.id });
  return row;
}

/** A new chat, without a feature, on `pick`, titled by its first message. */
export function newChat(context: SessionContext, root: string, pick?: SessionPick): SessionRow {
  return create(context, root, null, pick);
}

/**
 * Removes a chat while it has no turn, as the one made for a start that never landed, and reports
 * its removal, which the lists of its clients read again.
 */
export function removeEmpty(context: SessionContext, onChange: OnChange, id: string): void {
  const row = context.cache.session(id);
  context.cache.removeEmptySession(id);
  if (row !== undefined && context.cache.session(id) === undefined) {
    onChange({ folder: row.folder, repo: row.repo, session: id });
  }
}

/**
 * Moves a session without a workflow to the change it became, between turns: refused while its
 * agent works. Its open process closes, so its next turn opens in the change's worktree, and
 * resumes its agent session there.
 */
export async function attach(
  context: SessionContext,
  row: SessionRow,
  folder: string,
): Promise<void> {
  const { live: sessions, processes } = context;
  const live = sessions.of(row);
  await sessions.serial(live, async () => {
    if (live.turn !== undefined || live.queue.length > 0) {
      throw refused(REFUSALS.agentWorking);
    }
    context.cache.attach(live.id, folder);
    // Kept in memory with the folder it had: its next turn reads this one.
    live.folder = folder;
    if (live.proc) {
      processes.close(live.proc);
    }
    context.changed(live);
  });
}

/**
 * Archives every session of a dropped change or feature, their sub-sessions too, and closes their
 * processes.
 */
export function archiveFolder(
  context: SessionContext,
  onChange: OnChange,
  root: string,
  folder: string,
): void {
  const { cache } = context;
  const rows = cache
    .folderSessions(root, folder)
    .flatMap((row) => [row, ...cache.subSessionsOf(row.id)]);
  for (const row of rows) {
    const proc = context.live.get(row.id)?.proc;
    if (proc) {
      context.processes.close(proc);
    }
    context.cache.updateSession(row.id, { archivedAt: now() });
    onChange({ folder, repo: root, session: row.id });
  }
}
