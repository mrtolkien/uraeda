// A run by hand: "Run now" of a job in a repository. It reads no schedule, and shares the
// reservation of a start with the scheduler's queue, so a time and a run by hand never start two.
import { refused } from "../runner/session-state.ts";
import { works } from "./guards.ts";
import type { Options } from "./options.ts";
import { impossible } from "./problem.ts";
import { startRun } from "./run.ts";
import { keyOf, type Starts } from "./starts.ts";

/** What a run by hand reads of the scheduler. */
export type RunNowParts = Pick<Options, "context" | "isOn" | "jobs" | "repos"> & {
  now: () => Date;
  starts: Starts;
  /** Whether the scheduler stopped. */
  stopped: () => boolean;
};

/** See `Scheduler.runNow`. */
export async function runNow(
  parts: RunNowParts,
  repository: string,
  name: string,
): Promise<{ session: string }> {
  const { starts } = parts;
  const { jobs, problem } = await parts.jobs();
  const job = jobs.find((one) => one.name === name);
  const repo = parts.repos().find((one) => one.name === repository);
  if (problem !== undefined) {
    throw refused(problem);
  }
  if (job === undefined) {
    throw refused(`There is no job named “${name}”.`);
  }
  // A run by hand reads no schedule: only what makes a run impossible refuses it.
  const why = impossible(jobs, job);
  if (why !== undefined) {
    throw refused(why);
  }
  // Where the Jobs extension is off its place is gone and no job starts, by hand either.
  if (repo === undefined || !job.repositories.includes(repository) || !parts.isOn(repository)) {
    throw refused(`“${name}” does not run in ${repository}.`);
  }
  const ctx = parts.context(repo.path);
  const root = await ctx.sessions.mainRoot(repo.path);
  const last = ctx.sessions.cache.jobs.latestStarted(name, root);
  const key = keyOf(name, repository);
  if (
    parts.stopped() ||
    starts.has(key) ||
    starts.busy.has(name, root) ||
    (last?.session && works(ctx, last.session))
  ) {
    throw refused(`“${name}” still runs here.`);
  }
  starts.reserve(key);
  try {
    const run = { at: parts.now().getTime(), due: null, trigger: "manual" } as const;
    const started = await startRun(ctx, job, run, root);
    if (started === undefined) {
      throw new Error("a run by hand is recorded without a time");
    }
    return started;
  } finally {
    starts.release(key);
  }
}
