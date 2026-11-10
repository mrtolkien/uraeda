// What the scheduler reads of the repository before a start: the runtime a job runs on, whether a
// run's session works, and whether a change is still open.
import type { Job } from "uraeda-binding";
import type { RepoContext } from "../fate/context.ts";
import { blockedOf, turnsOf, statusOf } from "../fate/session-reads.ts";

/** The runtime the job's run starts on in the repository: its own, else the first one on there. */
export function agentOf(ctx: RepoContext, job: Job, root: string) {
  const { runtimes } = ctx.sessions;
  const name = job.agent ?? runtimes.defaultFor(root);
  if (name === undefined || runtimes.get(name) === undefined || !runtimes.isOn(name, root)) {
    return undefined;
  }
  return { available: runtimes.status(name).available };
}

/** Whether the session's agent works, or waits to continue by itself. */
export function works(ctx: RepoContext, session: string): boolean {
  const { sessions } = ctx;
  const row = sessions.cache.session(session);
  if (row === undefined) {
    return false;
  }
  if (sessions.sessionWorking(session)) {
    return true;
  }
  const { cache } = sessions;
  const { latest, queued } = turnsOf(cache, session);
  const read = {
    blocked: blockedOf(cache, latest),
    latest,
    queued,
    wakeup: sessions.wakeup(session),
  };
  return statusOf(row, read).status === "working";
}

/** What the workspace says of the changes: which are open, and each one's title. */
export type Changes = { open: ReadonlySet<string>; titles: ReadonlyMap<string, string> };

/**
 * The changes and features of the workspace, read once: the folders it still lists as not merged,
 * asked of each job, so a record of many jobs reads the workspace once, and every folder's title.
 */
export async function readChanges(ctx: RepoContext): Promise<Changes> {
  const { features } = await ctx.binding.readWorkspace(ctx.repo);
  return {
    open: new Set(
      features
        .filter((feature) => feature.step.name !== "done" && feature.step.name !== "none")
        .map((feature) => feature.folder),
    ),
    titles: new Map(features.map((feature) => [feature.folder, feature.title])),
  };
}

/** The folders of the changes and features the workspace still lists as not merged. */
export async function openFolders(ctx: RepoContext): Promise<ReadonlySet<string>> {
  return (await readChanges(ctx)).open;
}
