// A job's problem in the card's words, and what makes a run by hand impossible (R13).
import type { Job } from "uraeda-binding";

/**
 * The core's problem of a job in the card's words: a fragment, as the schedule's, follows "Not
 * running: "; a sentence stands alone, as "Two jobs are named “Dependencies”." does.
 */
export const coreProblem = (problem: string) =>
  problem.endsWith(".") ? problem : `Not running: ${problem}`;

/**
 * Why a run by hand of the job cannot start, and why its offer is not accepted, in the card's words,
 * or undefined. A schedule that is not understood is not a reason, since a run by hand reads no
 * schedule; any other problem is. The core reports the schedule's problem last, and `scheduleOnly`
 * says it is the one reported, so nothing else is wrong with the job (R43, R50). A name another job
 * has is read here: the core flags only the second of the two, and a write by it is refused.
 */
export function impossible(jobs: ReadonlyArray<Job>, job: Job): string | undefined {
  if (jobs.filter((one) => one.name === job.name).length > 1) {
    return `Two jobs are named “${job.name}”.`;
  }
  return job.problem !== undefined && !job.scheduleOnly ? coreProblem(job.problem) : undefined;
}
