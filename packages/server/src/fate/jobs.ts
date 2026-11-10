// The jobs in fate: the `Jobs` record of a repository's endpoint, the jobs that name it with their
// problem, next run, and history, read through the binding and the scheduler at each request and
// announced when a job, a run, or a run's session changes; and the answer of "Run now".
import { dataView } from "@nkzw/fate/server";
import type { Job, Schedule } from "uraeda-binding";
import { openFolders } from "../jobs/guards.ts";
import { coreProblem } from "../jobs/problem.ts";
import type { JobRunRow } from "../runner/cache-jobs.ts";
import { type Context, inRepository, type RepoContext } from "./context.ts";
import { fileSource } from "./source.ts";

/** The id of a repository's one `Jobs` record. */
export const JOBS_ID = "jobs";

/** A run of a job in the repository, or a time it skipped, as the page's history lists it. */
export type JobRunView = {
  /** When it started, or was skipped, as an ISO time. */
  at: string;
  /** The scheduled time it answers; null for "Run now". */
  due: string | null;
  /** The folder of the change its session became, when it did. */
  folder: string | null;
  id: string;
  outcome: "skipped" | "started";
  reason: "change-open" | "working" | null;
  session: string | null;
  /** Its session's title. */
  title: string | null;
  trigger: "manual" | "schedule";
};

/** A job that names the repository. */
export type JobRow = {
  agent: string | null;
  effort: string | null;
  history: Array<JobRunView>;
  /** The job's place in the file, which tells two jobs of one name apart. */
  index: number;
  /**
   * The latest run that started a session here, apart from `history`, which holds the 50 newest rows
   * and may hold none of the started ones.
   */
  last: JobRunView | null;
  model: string | null;
  name: string;
  /**
   * When it runs next, or the reason it does not: see `NextRun`. `text` is the server's own words
   * for an `agent-off` reason, null for the others.
   */
  next: { at: string | null; text: string | null; why: string | null };
  on: boolean;
  /** Why it does not run here, in the card's words, or null. */
  problem: string | null;
  prompt: string;
  reportOnly: boolean;
  repositories: Array<string>;
  schedule: Schedule | null;
  scheduleText: string;
};

/** The jobs of a repository, `problem` the settings file's when it cannot be read. */
export type JobsRecord = {
  /** The switch for all jobs. */
  enabled: boolean;
  id: string;
  jobs: Array<JobRow>;
  problem: string | null;
  /** The IANA zone of the server, the one the schedules run in and the times read in. */
  timeZone: string;
};

/** The answer of "Run now": the record, and the session the run started. */
export type JobsRunRecord = JobsRecord & { session: string };

export const jobsDataView = dataView<JobsRecord>("Jobs")({
  enabled: true,
  id: true,
  jobs: true,
  problem: true,
  timeZone: true,
});

export const jobsRunDataView = dataView<JobsRunRecord>("JobsRun")({
  enabled: true,
  id: true,
  jobs: true,
  problem: true,
  session: true,
  timeZone: true,
});

/**
 * Why the job does not run in the repository, from what only the server knows: a repository it
 * names that is not in the list. Null when none is missing.
 */
function localProblem(ctx: RepoContext, job: Job): string | null {
  const missing = job.repositories.find((name) => ctx.hosts.get(name) === undefined);
  return missing === undefined ? null : `“${missing}” is not in Uraeda's list.`;
}

/**
 * The words for a job whose agent does not run it in the repository: no agent on there, the named
 * one off or unknown, or the one it runs on not available. The runtime's title is its name for
 * people, as its other refusals say it.
 */
function agentWords(ctx: RepoContext, job: Job, root: string): string {
  const { runtimes } = ctx.sessions;
  const name = job.agent ?? runtimes.defaultFor(root);
  if (name === undefined) {
    return "Not running here: no agent is on in this repository.";
  }
  if (!runtimes.get(name) || !runtimes.isOn(name, root)) {
    return `Not running here: ${runtimes.title(name)} is off in this repository.`;
  }
  return `Not running here: ${runtimes.title(name)} is not available on this machine.`;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** A run of the job as the history lists it, with its session's folder and title. */
function viewOf(ctx: RepoContext, run: JobRunRow): JobRunView {
  const { cache } = ctx.sessions;
  const session = run.session === null ? undefined : cache.session(run.session);
  return {
    at: iso(run.at),
    due: run.due === null ? null : iso(run.due),
    folder: session?.folder ?? null,
    id: String(run.id),
    outcome: run.outcome,
    reason: run.reason,
    session: run.session,
    title: session?.title ?? null,
    trigger: run.trigger,
  };
}

/** The runs of the job in the repository, each with its session's folder and title. */
const historyOf = (ctx: RepoContext, job: string, root: string): Array<JobRunView> =>
  ctx.sessions.cache.jobs.history(job, root).map((run) => viewOf(ctx, run));

/** The job's latest run that started a session in the repository, or null. */
function lastOf(ctx: RepoContext, job: string, root: string): JobRunView | null {
  const run = ctx.sessions.cache.jobs.latestStarted(job, root);
  return run === undefined ? null : viewOf(ctx, run);
}

/** The job as the repository lists it: `name` is the repository's name in the list. */
async function rowOf(
  ctx: RepoContext,
  job: Job,
  place: { index: number; name: string; open: ReadonlySet<string>; root: string },
): Promise<JobRow> {
  const { index, name, open, root } = place;
  const next = ctx.jobs === undefined ? undefined : await ctx.jobs.nextRun(job, name, open);
  return {
    agent: job.agent ?? null,
    effort: job.effort ?? null,
    history: historyOf(ctx, job.name, root),
    index,
    last: lastOf(ctx, job.name, root),
    model: job.model ?? null,
    name: job.name,
    next:
      next === undefined
        ? { at: null, text: null, why: null }
        : "at" in next
          ? { at: next.at.toISOString(), text: null, why: null }
          : {
              at: null,
              text: next.why === "agent-off" ? agentWords(ctx, job, root) : null,
              why: next.why,
            },
    on: job.on,
    problem: job.problem === undefined ? localProblem(ctx, job) : coreProblem(job.problem),
    prompt: job.prompt,
    reportOnly: job.reportOnly,
    repositories: job.repositories,
    schedule: job.schedule ?? null,
    scheduleText: job.scheduleText,
  };
}

/** The `Jobs` record of the repository of `ctx` now: its jobs in the file's order. */
export async function jobsRecord(ctx: RepoContext): Promise<JobsRecord> {
  const { jobs, problem } = await ctx.binding.readJobs(ctx.settings.dir);
  const name = ctx.hosts.byPath(ctx.repo)?.name;
  const root = await ctx.sessions.mainRoot(ctx.repo);
  // Each job here with its place in the file, which the jobs of another repository leave gaps in.
  const here = jobs
    .map((job, index) => ({ index, job }))
    .filter(({ job }) => name !== undefined && job.repositories.includes(name));
  // The workspace is read once for the record, and only when a job started a change to look at.
  const started = here.some(
    ({ job }) => ctx.sessions.cache.jobs.changeFolders(job.name, root).length > 0,
  );
  const open = started ? await openFolders(ctx) : new Set<string>();
  return {
    enabled: ctx.settings.runs().scheduledJobs.inForce,
    id: JOBS_ID,
    jobs: await Promise.all(
      here.map(({ index, job }) => rowOf(ctx, job, { index, name: name!, open, root })),
    ),
    problem: problem ?? null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** The jobs' sources: their records are read on a repository's endpoint only. */
export const jobSources = [
  fileSource(jobsDataView, {
    byIds: async (ctx: Context, ids) =>
      ids.includes(JOBS_ID) ? [await jobsRecord(inRepository(ctx))] : [],
  }),
  // An answer of "Run now", read once, from its mutation: nothing to read again.
  fileSource(jobsRunDataView, { byIds: async () => [] }),
];
