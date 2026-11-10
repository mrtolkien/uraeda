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

/** The workspace's open folders, and the folders of a job's runs when it was read. */
export type Read = { folders: ReadonlyArray<string>; open: ReadonlySet<string> };

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
   * The folders of the workspace's open changes, when a run of the job started a change to look at,
   * with the folders of the job's runs as they were when the read began: the one read of the
   * workspace a skip needs, which awaits, so a start reads it before anything it must decide on as
   * close to the start as it can. A folder the runs name after that is not in the read (R52).
   */
  async openFor(ctx: RepoContext, job: string, root: string): Promise<Read | undefined> {
    const folders = ctx.sessions.cache.jobs.changeFolders(job, root);
    return folders.length === 0 ? undefined : { folders, open: await openFolders(ctx) };
  }

  /**
   * Why the job's time is skipped in the repository: its last run works, or an acceptance is opening
   * its change, or a change it started is open. The open-change read is awaited first, and what
   * comes after reads without awaiting (`skipNow`).
   */
  async skipOf(
    ctx: RepoContext,
    job: Job,
    root: string,
    open?: ReadonlySet<string>,
  ): Promise<{ folder?: string; reason: Skipped } | undefined> {
    // Open folders given were read now, as the runs' folders are.
    const read =
      open === undefined
        ? await this.openFor(ctx, job.name, root)
        : { folders: ctx.sessions.cache.jobs.changeFolders(job.name, root), open };
    return this.skipNow(ctx, job, root, read);
  }

  /**
   * `skipOf` with the read of the workspace given, awaiting nothing, so a start that read it first
   * decides with nothing between its last read and its start. A folder the job's runs name now that
   * they did not name when it was read, or all of them when it was not read, counts as open: a
   * change a run's offer opened meanwhile is not in the read, and a time is skipped rather than run
   * beside a change (R52).
   */
  skipNow(
    ctx: RepoContext,
    job: Job,
    root: string,
    read: Read | undefined,
  ): { folder?: string; reason: Skipped } | undefined {
    const { jobs } = ctx.sessions.cache;
    // Any run of the job that started a change still open, not only the latest run.
    const folders = jobs.changeFolders(job.name, root);
    const last = jobs.latestStarted(job.name, root);
    if (this.busy.has(job.name, root) || (last?.session && works(ctx, last.session))) {
      return { reason: "working" };
    }
    // The open change of the latest run that started one: the one a person looks for (R36).
    const folder = folders.find(
      (one) => read === undefined || read.open.has(one) || !read.folders.includes(one),
    );
    return folder === undefined ? undefined : { folder, reason: "change-open" };
  }
}
