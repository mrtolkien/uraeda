// What the Jobs place's panes share: its record, the job of a name, its pages' routes, and "Run
// now", which the card, the job's page, and the phone's bottom bar all start, and whose refusal
// shows where it was asked for.
import { signal } from "nsh";
import { call, navigate, record } from "../../store";
import type { Job, Jobs } from "../../store/protocol";
import { refusalOf } from "../../ui/controls";

/** A pane of a job: its repository and its name. */
export type JobArgs = { name: string; repo: string };

/** The repository's jobs, live. */
export const jobsOf = (repo: string) => record("Jobs", { repo });

/** The job of a name, the first in the file's order: two of one name refuse writes until renamed. */
export const jobNamed = (jobs: Jobs | null | undefined, name: string): Job | undefined =>
  jobs?.jobs.find((one) => one.name === name);

/** A job's page. */
export const openJob = (repo: string, name: string) => navigate({ name, page: "job", repo });

/** Why "Run now" of a job was refused, by `repo/name`, until it is asked again or dismissed. */
const runRefusals = signal<Readonly<Record<string, string>>>({});

export const runRefusal = (args: JobArgs) => runRefusals()[`${args.repo}/${args.name}`] ?? null;

export function dismissRun(args: JobArgs) {
  const { [`${args.repo}/${args.name}`]: _, ...rest } = runRefusals();
  runRefusals.set(rest);
}

/**
 * Runs the job now, whatever its schedule or its pause, and opens the session it started; a
 * refusal, as "“Dependencies” still runs here.", is kept for where it was asked.
 */
export async function runNow(args: JobArgs): Promise<string | null> {
  dismissRun(args);
  try {
    const ran = await call("jobs.runNow", { name: args.name, repo: args.repo });
    navigate({ id: ran.session, page: "session-id", repo: args.repo }, { created: true });
    return null;
  } catch (error) {
    const words = refusalOf(error);
    runRefusals.update((all) => ({ ...all, [`${args.repo}/${args.name}`]: words }));
    return words;
  }
}
