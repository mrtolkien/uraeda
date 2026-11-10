// A scheduled job's run: its row in the record of runs, then its session. The row goes first, so the
// unique index of a job, repository, and time stops a second start of one time, from two ticks, two
// servers, or a clock set back (the plan's review focus; R9).
import type { Job } from "uraeda-binding";
import type { RepoContext } from "../fate/context.ts";
import { jobMessage, runNowLine, scheduleLine } from "../runner/message.ts";

/**
 * Starts the run of `job` in the repository of `ctx`: records its row, opens a chat on the job's
 * agent, model, and effort, titled by the job's name, and sends it the job's message, which says
 * why it ran, from the workflow. Returns undefined when its time is recorded already: it starts
 * once. A chat that does not start removes the row, so its time is not marked run, and throws.
 */
export async function startRun(
  ctx: RepoContext,
  job: Job,
  run: { at: number; due: number | null; trigger: "manual" | "schedule" },
): Promise<{ session: string } | undefined> {
  const { repo, sessions } = ctx;
  const { cache } = sessions;
  const repository = await sessions.mainRoot(repo);
  const row = cache.jobs.add({
    at: run.at,
    due: run.due,
    job: job.name,
    outcome: "started",
    reason: null,
    repository,
    session: null,
    trigger: run.trigger,
  });
  if (row === undefined) {
    return undefined;
  }
  let session: string | undefined;
  try {
    const pick = {
      ...(job.agent === undefined ? {} : { runtime: job.agent }),
      ...(job.model === undefined ? {} : { model: job.model }),
      ...(job.effort === undefined ? {} : { effort: job.effort }),
    };
    session = (await sessions.newChat(repo, pick)).id;
    // Before the first turn: the turn's end, which reads the row by its session, finds it.
    cache.jobs.setSession(row.id, session);
    sessions.rename(repo, session, job.name);
    await sessions.send(repo, session, {
      line: run.trigger === "manual" ? runNowLine(job.name) : scheduleLine(job.name),
      origin: "workflow",
      text: jobMessage(job),
    });
  } catch (error) {
    cache.jobs.remove(row.id);
    // A chat made and not started holds no turn: it goes with its row, and its clients are told.
    if (session !== undefined) {
      sessions.removeEmpty(session);
    }
    throw error;
  }
  return { session };
}
