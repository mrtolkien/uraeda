import { randomUUID } from "node:crypto";
import type { SessionRow } from "./cache.ts";
import { transaction } from "./migrations.ts";
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

/** A new session of the agent's, in `root`, of `folder` or a chat. */
function create(context: SessionContext, root: string, folder: string | null): SessionRow {
  return context.cache.createSession({
    agent: context.adapter.kind,
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
 * The latest session of a change or a feature, created when it has none: refused for a dropped
 * one, whose sessions are all archived, so its runs never recreate its worktree.
 */
export function featureSession(context: SessionContext, root: string, folder: string): SessionRow {
  const { cache } = context;
  // One transaction: another server cannot create a first session between the read and the write.
  return transaction(cache.db, () => {
    const latest = cache.latestSession(root, folder);
    refuseDropped(latest);
    return latest ?? create(context, root, folder);
  });
}

/**
 * A new session of a change or a feature, which becomes its latest: its runs go to it. Its
 * feature's open pages are sent it. Refused for a dropped one.
 */
export function newSession(
  context: SessionContext,
  onChange: OnChange,
  root: string,
  folder: string,
): SessionRow {
  refuseDropped(context.cache.latestSession(root, folder));
  const row = create(context, root, folder);
  onChange({ folder, repo: root, session: row.id });
  return row;
}

/** A new chat, without a feature, titled by its first message. */
export function newChat(context: SessionContext, root: string): SessionRow {
  return create(context, root, null);
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

/** Archives every session of a dropped change or feature, and closes their processes. */
export function archiveFolder(
  context: SessionContext,
  onChange: OnChange,
  root: string,
  folder: string,
): void {
  for (const row of context.cache.folderSessions(root, folder)) {
    const proc = context.live.get(row.id)?.proc;
    if (proc) {
      context.processes.close(proc);
    }
    context.cache.updateSession(row.id, { archivedAt: now() });
    onChange({ folder, repo: root, session: row.id });
  }
}
