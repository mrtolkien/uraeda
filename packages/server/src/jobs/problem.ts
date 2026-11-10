// A job's problem in the card's words, and what makes a run by hand impossible (R13).
import type { Job } from "uraeda-binding";

/**
 * The core's problem of a job in the card's words: a fragment, as the schedule's, follows "Not
 * running: "; a sentence stands alone, as "Two jobs are named “Dependencies”." does.
 */
export const coreProblem = (problem: string) =>
  problem.endsWith(".") ? problem : `Not running: ${problem}`;

/**
 * Why a run by hand of the job cannot start, in the card's words, or undefined. A schedule that is
 * not understood is not a reason, since a run by hand reads no schedule: only a name shared with
 * another job, no prompt, and the problems the job has apart from its schedule are.
 */
export function impossible(jobs: ReadonlyArray<Job>, job: Job): string | undefined {
  if (jobs.filter((one) => one.name === job.name).length > 1) {
    return `Two jobs are named “${job.name}”.`;
  }
  if (job.name.trim() === "") {
    return "A job has no name.";
  }
  if (job.prompt.trim() === "") {
    return "A job has no prompt.";
  }
  // With a schedule read, whatever problem the job has is not the schedule's.
  return job.problem !== undefined && job.schedule !== undefined
    ? coreProblem(job.problem)
    : undefined;
}
