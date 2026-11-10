// The scheduler: the only code that starts a scheduled run. Each tick reads the jobs, and starts the
// time each one is due, unless the server did not see it arrive (R2), the job's last run still works
// there, or the change it started is still open. Every start goes through the record of runs, which
// holds one row per time, so a time is started once.
import type { Job, Jobs } from "uraeda-binding";
import type { RepoContext } from "../fate/context.ts";
import { blockedOf, turnsOf, statusOf } from "../fate/session-reads.ts";
import { reasonOf } from "../reason.ts";
import type { JobRunRow } from "../runner/cache-jobs.ts";
import { refused } from "../runner/session-state.ts";
import { type Runs, serially } from "../serially.ts";
import { startRun } from "./run.ts";
import { sleep } from "./sleep.ts";
import { dueAt, MISSED_AFTER_MS, nextAfter } from "./times.ts";

/** The scheduler looks every 30 seconds. */
const TICK_MS = 30_000;

/** Runs due together start a minute apart. */
const APART_MS = 60_000;

/** When a job runs next in a repository, or why it does not. */
export type NextRun =
  | { at: Date }
  | { why: "agent-off" | "change-open" | "off" | "paused" | "problem" };

/** The scheduler's triggers, and its stop. */
export type Scheduler = {
  /** When the job runs next in the repository, or why it does not. */
  nextRun(job: Job, repo: string): Promise<NextRun>;
  /** Starts the job's run in the repository now, refused while its latest run works there. */
  runNow(repo: string, name: string): Promise<{ session: string }>;
  /** Starts no other run, and resolves once the ones in flight end. */
  stop(): Promise<void>;
  /** Looks for due times now: one asked while a tick runs joins the one after it. */
  tick(): Promise<void>;
};

/** A time due in a repository, to start. */
type Due = { due: number; job: Job; repo: { name: string; path: string } };

/** The runtime the job's run starts on in the repository: its own, else the first one on there. */
function agentOf(ctx: RepoContext, job: Job, root: string) {
  const { runtimes } = ctx.sessions;
  const name = job.agent ?? runtimes.defaultFor(root);
  if (name === undefined || runtimes.get(name) === undefined || !runtimes.isOn(name, root)) {
    return undefined;
  }
  return { available: runtimes.status(name).available };
}

/** Whether the session's agent works, or waits to continue by itself. */
function works(ctx: RepoContext, session: string): boolean {
  const { sessions } = ctx;
  const row = sessions.cache.session(session);
  if (row === undefined) {
    return false;
  }
  if (sessions.sessionWorking(session)) {
    return true;
  }
  const { cache } = sessions;
  const { latest, queued } = turnsOf(cache, session);
  const read = {
    blocked: blockedOf(cache, latest),
    latest,
    queued,
    wakeup: sessions.wakeup(session),
  };
  return statusOf(row, read).status === "working";
}

/** Whether the session belongs to a change or a feature the workspace still lists as not merged. */
async function changeOpen(ctx: RepoContext, session: string): Promise<boolean> {
  const folder = ctx.sessions.cache.session(session)?.folder ?? null;
  if (folder === null) {
    return false;
  }
  const { features } = await ctx.binding.readWorkspace(ctx.repo);
  return features.some(
    (feature) =>
      feature.folder === folder && feature.step.name !== "done" && feature.step.name !== "none",
  );
}

/** What `startScheduler` takes: see it. */
type Options = {
  context: (repo: string) => RepoContext;
  /** The switch for all jobs. */
  enabled: () => boolean;
  /** Ms between ticks, 30 seconds by default; null: the test ticks. */
  every?: number | null;
  /** Whether the `jobs` extension is on in the repository of this name. */
  isOn: (repository: string) => boolean;
  jobs: () => Promise<Jobs>;
  now?: () => Date;
  repos: () => Array<{ name: string; path: string }>;
  /** The minute between runs. */
  wait?: (ms: number) => Promise<void>;
};

/** The key of a job in a repository, by its name or its main checkout. */
const keyOf = (job: string, repository: string) => `${job}\0${repository}`;

class JobScheduler implements Scheduler {
  readonly #options: Options;
  readonly #now: () => Date;
  readonly #wait: (ms: number) => Promise<void>;
  readonly #timer: ReturnType<typeof setInterval> | undefined;
  #stopped = false;
  readonly #stop = new AbortController();
  // When this scheduler first saw each job on in each repository, in ms (R2).
  readonly #seen = new Map<string, number>();
  // The job and repository whose run starts now: a time and a run by hand never start two.
  readonly #starting = new Set<string>();
  readonly #printed = new Set<string>();
  readonly #flying = new Set<Promise<unknown>>();
  readonly #ticks = new Map<string, Runs>();

  constructor(options: Options) {
    this.#options = options;
    this.#now = options.now ?? (() => new Date());
    this.#wait = options.wait ?? ((ms) => sleep(ms, this.#stop.signal));
    if (options.every !== null) {
      this.#timer = setInterval(() => void this.tick(), options.every ?? TICK_MS);
      this.#timer.unref();
      // The first look, now: it sets the moment each job was first seen, and starts nothing past.
      void this.tick();
    }
  }

  #on(): boolean {
    return !this.#stopped && this.#options.enabled();
  }

  /** Prints a problem once. */
  #print(key: string, text: string): void {
    if (!this.#printed.has(key)) {
      this.#printed.add(key);
      process.stderr.write(`uraeda: ${text}\n`);
    }
  }

  /** Tracks work the stop waits for. */
  #track<T>(work: Promise<T>): Promise<T> {
    this.#flying.add(work);
    void work.then(
      () => this.#flying.delete(work),
      () => this.#flying.delete(work),
    );
    return work;
  }

  tick = (): Promise<void> =>
    this.#track(
      serially(this.#ticks, "tick", async () => {
        try {
          await this.#once();
        } catch (error) {
          this.#print(`tick\0${reasonOf(error)}`, `the scheduled jobs stopped: ${reasonOf(error)}`);
        }
      }),
    );

  async stop(): Promise<void> {
    this.#stopped = true;
    this.#stop.abort();
    clearInterval(this.#timer);
    await Promise.allSettled(this.#flying);
  }

  async #once(): Promise<void> {
    if (!this.#on()) {
      this.#seen.clear();
      return;
    }
    const { jobs, problem } = await this.#options.jobs();
    if (problem !== undefined) {
      this.#seen.clear();
      return;
    }
    let started = false;
    for (const item of await this.#dueNow(jobs, this.#now())) {
      if (started) {
        await this.#wait(APART_MS);
      }
      // The switch turned off, or the server stopping, during the waits starts no other.
      if (!this.#on()) {
        return;
      }
      started = (await this.#run(item)) || started;
    }
  }

  /** The times due now, in the repositories where each job runs. */
  async #dueNow(jobs: Jobs["jobs"], at: Date): Promise<Array<Due>> {
    const found: Array<Due> = [];
    const eligible = new Set<string>();
    const repos = this.#options.repos();
    for (const job of jobs) {
      if (!job.on || job.problem !== undefined || job.schedule === undefined) {
        continue;
      }
      const due = dueAt(job.schedule, at).getTime();
      for (const name of job.repositories) {
        const repo = repos.find((one) => one.name === name);
        if (repo === undefined || !this.#options.isOn(name)) {
          continue;
        }
        const ctx = this.#options.context(repo.path);
        const agent = agentOf(ctx, job, await ctx.sessions.mainRoot(repo.path));
        if (agent === undefined) {
          continue;
        }
        const key = keyOf(job.name, name);
        eligible.add(key);
        const first = this.#seen.get(key) ?? at.getTime();
        this.#seen.set(key, first);
        // A time the server saw arrive, and not missed.
        if (agent.available && due > first && at.getTime() - due <= MISSED_AFTER_MS) {
          found.push({ due, job, repo });
        }
      }
    }
    // A job off, paused, or in no repository there loses the moment it was seen: back on, it is new.
    for (const key of this.#seen.keys()) {
      if (!eligible.has(key)) {
        this.#seen.delete(key);
      }
    }
    return found;
  }

  /** Why the job's time is skipped in the repository: its last run works, or its change is open. */
  async #skipOf(
    ctx: RepoContext,
    job: Job,
    root: string,
  ): Promise<JobRunRow["reason"] | undefined> {
    const last = ctx.sessions.cache.jobs.latestStarted(job.name, root);
    if (this.#starting.has(keyOf(job.name, root)) || (last?.session && works(ctx, last.session))) {
      return "working";
    }
    return last?.session && (await changeOpen(ctx, last.session)) ? "change-open" : undefined;
  }

  /** Starts, or skips, one due time. Returns whether it started a session. */
  async #run({ due, job, repo }: Due): Promise<boolean> {
    const ctx = this.#options.context(repo.path);
    const root = await ctx.sessions.mainRoot(repo.path);
    const runs = ctx.sessions.cache.jobs;
    // Read first: a time recorded already is nobody's to start or skip again.
    if (runs.recorded(job.name, root, due)) {
      return false;
    }
    const reason = await this.#skipOf(ctx, job, root);
    if (reason !== undefined) {
      runs.add({
        at: this.#now().getTime(),
        due,
        job: job.name,
        outcome: "skipped",
        reason,
        repository: root,
        session: null,
        trigger: "schedule",
      });
      return false;
    }
    const key = keyOf(job.name, root);
    this.#starting.add(key);
    try {
      const run = { at: this.#now().getTime(), due, trigger: "schedule" } as const;
      return (await startRun(ctx, job, run)) !== undefined;
    } catch (error) {
      const why = `the run of ${job.name} in ${repo.name} was refused: ${reasonOf(error)}`;
      this.#print(`${key}\0${due}`, why);
      return false;
    } finally {
      this.#starting.delete(key);
    }
  }

  async nextRun(job: Job, repository: string): Promise<NextRun> {
    if (job.problem !== undefined || job.schedule === undefined) {
      return { why: "problem" };
    }
    if (!job.on) {
      return { why: "paused" };
    }
    if (!this.#options.enabled()) {
      return { why: "off" };
    }
    const repo = this.#options.repos().find((one) => one.name === repository);
    if (repo !== undefined) {
      const ctx = this.#options.context(repo.path);
      const root = await ctx.sessions.mainRoot(repo.path);
      if (!agentOf(ctx, job, root)?.available) {
        return { why: "agent-off" };
      }
      if ((await this.#skipOf(ctx, job, root)) === "change-open") {
        return { why: "change-open" };
      }
    }
    return { at: nextAfter(job.schedule, this.#now()) };
  }

  runNow(repository: string, name: string): Promise<{ session: string }> {
    return this.#track(this.#runNow(repository, name));
  }

  async #runNow(repository: string, name: string): Promise<{ session: string }> {
    const { jobs, problem } = await this.#options.jobs();
    const job = jobs.find((one) => one.name === name);
    const repo = this.#options.repos().find((one) => one.name === repository);
    if (problem !== undefined || job === undefined || job.problem !== undefined) {
      throw refused(problem ?? job?.problem ?? `There is no job named “${name}”.`);
    }
    if (repo === undefined || !job.repositories.includes(repository)) {
      throw refused(`“${name}” does not run in ${repository}.`);
    }
    const ctx = this.#options.context(repo.path);
    const root = await ctx.sessions.mainRoot(repo.path);
    const last = ctx.sessions.cache.jobs.latestStarted(name, root);
    const key = keyOf(name, root);
    if (this.#stopped || this.#starting.has(key) || (last?.session && works(ctx, last.session))) {
      throw refused(`“${name}” still runs here.`);
    }
    this.#starting.add(key);
    try {
      const run = { at: this.#now().getTime(), due: null, trigger: "manual" } as const;
      const started = await startRun(ctx, job, run);
      if (started === undefined) {
        throw new Error("a run by hand is recorded without a time");
      }
      return started;
    } finally {
      this.#starting.delete(key);
    }
  }
}

/**
 * Starts the scheduler. A tick reads `jobs()`, and, while `enabled()`, starts each time due in a
 * repository of the list where the job is on, its extension is on, and its agent is available. The
 * starts of a tick go one after another, the first at once, each next after `wait(60_000)`. A test
 * gives the clock, `now`, and the waits, and ticks by itself with `every: null`.
 */
export function startScheduler(options: Options): Scheduler {
  return new JobScheduler(options);
}
