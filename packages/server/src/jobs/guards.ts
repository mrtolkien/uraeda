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

/** Whether any of the folders is a change or a feature the workspace still lists as not merged. */
export async function anyOpen(ctx: RepoContext, folders: Array<string>): Promise<boolean> {
  if (folders.length === 0) {
    return false;
  }
  const { features } = await ctx.binding.readWorkspace(ctx.repo);
  return features.some(
    (feature) =>
      folders.includes(feature.folder) &&
      feature.step.name !== "done" &&
      feature.step.name !== "none",
  );
}
