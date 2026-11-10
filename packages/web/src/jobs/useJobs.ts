// The `Jobs` record of the repository, as the Jobs place and a job's page read it, and the writes
// they send: each gives the refusal in the scheduler's or the core's words, or nothing.
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { JobInput } from "uraeda-binding";
import type { Jobs, JobsRecord, JobsRun } from "uraeda-server/fate";
import { useRefreshOnShow } from "../data.ts";
import { refusal } from "../errors.ts";

/** The id of the repository's one `Jobs` record, as the server names it (`JOBS_ID`). */
const JOBS_ID = "jobs";

/** The record: whether jobs run, the file's problem, and each job here with its next run and history. */
const JobsView = view<Jobs>()({
  enabled: true,
  id: true,
  jobs: true,
  problem: true,
  timeZone: true,
});

/** The answer of "Run now": the record, and the session it started. */
const JobsRunView = view<JobsRun>()({
  enabled: true,
  id: true,
  jobs: true,
  problem: true,
  session: true,
  timeZone: true,
});

/**
 * The jobs that name the repository, live: read again as a job, a run, or the file changes, and as
 * the page comes back to the foreground, as the settings and the extensions are.
 */
export function useJobs(): JobsRecord {
  const request = { jobs: { id: JOBS_ID, view: JobsView } };
  const { jobs } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(JobsView, jobs) as unknown as JobsRecord;
}

/** What a write of the jobs gave: the refusal in words, or nothing. */
type Refused = string | undefined;

/** The refusal a result carries, in words. */
const refused = (result: { error?: unknown }): Refused =>
  result.error ? refusal(result.error).message : undefined;

/**
 * The jobs' writes, which the card and the job's page send. Each answers the refusal, never throws:
 * a name taken, a time out of range, or a run that still works.
 */
export function useJobActions() {
  const fate = useFateClient();
  const { jobs } = fate.mutations;
  return {
    add: async (job: JobInput): Promise<Refused> =>
      refused(await jobs.add({ input: { job }, view: JobsView })),
    remove: async (name: string): Promise<Refused> =>
      refused(await jobs.remove({ input: { name }, view: JobsView })),
    runNow: async (name: string): Promise<{ refused: string } | { session: string }> => {
      const result = await jobs.runNow({ input: { name }, view: JobsRunView });
      const session = result.result?.session;
      return result.error || typeof session !== "string"
        ? { refused: refused(result) ?? "The job did not start." }
        : { session };
    },
    setOn: async (name: string, on: boolean): Promise<Refused> =>
      refused(await jobs.setOn({ input: { name, on }, view: JobsView })),
    update: async (name: string, job: JobInput): Promise<Refused> =>
      refused(await jobs.update({ input: { job, name }, view: JobsView })),
  };
}
