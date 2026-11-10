// When a job runs next in a repository, or why it does not: the card's "Next run", in the order the
// scheduler decides in. It starts nothing and queues nothing.
import type { Job } from "uraeda-binding";
import { agentOf } from "./guards.ts";
import type { Options } from "./options.ts";
import type { Starts } from "./starts.ts";
import { nextAfter } from "./times.ts";

/** When a job runs next in a repository, or why it does not. */
export type NextRun =
  | { at: Date }
  | { why: "agent-off" | "change-open" | "off" | "paused" | "problem" };

/** What the card's next run reads of the scheduler. */
export type NextRunParts = Pick<Options, "context" | "enabled" | "repos"> & {
  now: () => Date;
  starts: Starts;
};

/** See `Scheduler.nextRun`. */
export async function nextRun(
  parts: NextRunParts,
  job: Job,
  repository: string,
  open?: ReadonlySet<string>,
): Promise<NextRun> {
  if (job.problem !== undefined || job.schedule === undefined) {
    return { why: "problem" };
  }
  if (!job.on) {
    return { why: "paused" };
  }
  if (!parts.enabled()) {
    return { why: "off" };
  }
  const repo = parts.repos().find((one) => one.name === repository);
  if (repo !== undefined) {
    const ctx = parts.context(repo.path);
    const root = await ctx.sessions.mainRoot(repo.path);
    if (!agentOf(ctx, job, root)?.available) {
      return { why: "agent-off" };
    }
    if ((await parts.starts.skipOf(ctx, job, root, open))?.reason === "change-open") {
      return { why: "change-open" };
    }
  }
  return { at: nextAfter(job.schedule, parts.now()) };
}
