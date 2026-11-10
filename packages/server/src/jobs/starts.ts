// The owner of what a start shares: the job and repository whose start is reserved, the jobs an
// acceptance holds busy, and the reason a time is skipped. The scheduler's queue, a run by hand, and
// the card's next run read it, so each decides on the same state.
import type { Job } from "uraeda-binding";
import type { RepoContext } from "../fate/context.ts";
import type { JobRunRow } from "../runner/cache-jobs.ts";
import { Busy } from "./busy.ts";
import { openFolders, works } from "./guards.ts";

/** Why a time is skipped. */
export type Skipped = NonNullable<JobRunRow["reason"]>;

/** The key of a job in a repository, both by name. */
export const keyOf = (job: string, repository: string) => `${job}\0${repository}`;

export class Starts {
  readonly busy: Busy;
  // The job and repository (by its name) whose run starts now: a time and a run by hand never start two.
  readonly #reserved = new Set<string>();

  constructor(busy = new Busy()) {
    this.busy = busy;
  }

  /** Whether a start of the job in the repository (by its name) is reserved. */
  has(key: string): boolean {
    return this.#reserved.has(key);
  }

  /** Reserves the start of a job in a repository. */
  reserve(key: string): void {
    this.#reserved.add(key);
  }

  /** Releases the reservation of a start. */
  release(key: string): void {
    this.#reserved.delete(key);
  }

  /**
   * Why the job's time is skipped in the repository: its last run works, or an acceptance is opening
   * its change, or a change it started is open. The open-change read is awaited first, so the
   * synchronous reads of what works come last, as close to the start as they can.
   */
  async skipOf(
    ctx: RepoContext,
    job: Job,
    root: string,
    open?: ReadonlySet<string>,
  ): Promise<{ folder?: string; reason: Skipped } | undefined> {
    const { jobs } = ctx.sessions.cache;
    // Any run of the job that started a change still open, not only the latest run.
    const folders = jobs.changeFolders(job.name, root);
    const opened = folders.length === 0 ? undefined : (open ?? (await openFolders(ctx)));
    const last = jobs.latestStarted(job.name, root);
    if (this.busy.has(job.name, root) || (last?.session && works(ctx, last.session))) {
      return { reason: "working" };
    }
    // The open change of the latest run that started one: the one a person looks for (R36).
    const folder = opened === undefined ? undefined : folders.find((one) => opened.has(one));
    return folder === undefined ? undefined : { folder, reason: "change-open" };
  }
}
