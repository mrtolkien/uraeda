// The jobs' mutations, on a repository's endpoint: adding, editing, pausing, and removing a job in
// the settings file through the binding, and "Run now". Each answers the repository's `Jobs`
// record, "Run now" with the session it started.
import type { JobInput } from "uraeda-binding";
import { announceJobs } from "../jobs/announce.ts";
import { refused } from "../runner/session-state.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { settingsWrite } from "./errors.ts";
import { jobsDataView, jobsRecord, jobsRunDataView } from "./jobs.ts";
import { refusedOn } from "./list-mutations.ts";
import { sources } from "./sources.ts";

/**
 * Writes through the binding, a file that cannot be read refused with its problem, then sends the
 * record's update and answers the record, masked to the fields selected.
 */
async function written(
  { ctx, select }: Omit<Resolver<unknown>, "input">,
  write: () => Promise<void>,
) {
  await settingsWrite(write);
  announceJobs(ctx.hosts);
  return sources.masked(jobsDataView, ctx, await jobsRecord(ctx), select);
}

/** Starts the job's run in the request's repository now, refused while its last run works. */
async function runNow(ctx: RepoContext, name: string): Promise<{ session: string }> {
  const repository = ctx.hosts.byPath(ctx.repo)?.name;
  if (!ctx.jobs || repository === undefined) {
    throw refused("the scheduled jobs are not running");
  }
  return ctx.jobs.runNow(repository, name);
}

export const jobMutations = {
  "jobs.add": {
    resolve: ({ input, ...call }: Resolver<{ job: JobInput }>) =>
      written(call, () => call.ctx.binding.addJob(call.ctx.settings.dir, input.job)),
    type: "Jobs",
  },
  "jobs.remove": {
    resolve: ({ input, ...call }: Resolver<{ name: string }>) =>
      written(call, () => call.ctx.binding.removeJob(call.ctx.settings.dir, input.name)),
    type: "Jobs",
  },
  "jobs.runNow": {
    resolve: async ({ ctx, input, select }: Resolver<{ name: string }>) => {
      const { session } = await refusedOn(() => runNow(ctx, input.name));
      return sources.masked(jobsRunDataView, ctx, { ...(await jobsRecord(ctx)), session }, select);
    },
    type: "JobsRun",
  },
  "jobs.setOn": {
    resolve: ({ input, ...call }: Resolver<{ name: string; on: boolean }>) =>
      written(call, () => call.ctx.binding.setJobOn(call.ctx.settings.dir, input.name, input.on)),
    type: "Jobs",
  },
  // A rename moves the job's runs too: the page keeps its history under the new name.
  "jobs.update": {
    resolve: ({ input, ...call }: Resolver<{ job: JobInput; name: string }>) =>
      written(call, async () => {
        const { ctx } = call;
        await ctx.binding.updateJob(ctx.settings.dir, input.name, input.job);
        ctx.sessions.cache.jobs.rename(input.name.trim(), input.job.name.trim());
      }),
    type: "Jobs",
  },
};
