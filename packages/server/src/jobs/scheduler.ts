// The scheduler: the only code that starts a scheduled run. Each tick reads the jobs, and starts the
// time each one is due, unless the server did not see it arrive (R2), the job's last run still works
// there, or the change it started is still open. Every start goes through the record of runs, which
// holds one row per time, so a time is started once.
import type { Job, Jobs } from "uraeda-binding";
import type { RepoContext } from "../fate/context.ts";
import { reasonOf } from "../reason.ts";
import type { JobRunRow } from "../runner/cache-jobs.ts";
import { refused } from "../runner/session-state.ts";
import { type Runs, serially } from "../serially.ts";
import { Busy } from "./busy.ts";
import { agentOf, openFolders, works } from "./guards.ts";
import { impossible } from "./problem.ts";
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
  /**
   * When the job runs next in the repository, or why it does not. A caller asking for many jobs
   * gives the open folders it read once; without them, the workspace is read for the job.
   */
  nextRun(job: Job, repo: string, open?: ReadonlySet<string>): Promise<NextRun>;
  /** Starts the job's run in the repository now, refused while its latest run works there. */
  runNow(repo: string, name: string): Promise<{ session: string }>;
  /** Resolves once the times queued are started, skipped, or dropped. */
  settled(): Promise<void>;
  /** Starts no other run, and resolves once the ones in flight end. */
  stop(): Promise<void>;
  /**
   * Looks for due times now, and queues them for `settled`: one asked while a tick runs joins the one
   * after it. It does not wait for the starts, which a minute separates.
   */
  tick(): Promise<void>;
};

/** Why a time is skipped. */
type Skipped = NonNullable<JobRunRow["reason"]>;

/** A time due in a repository, to start. */
type Due = { due: number; job: Job; repo: { name: string; path: string } };

/** What `startScheduler` takes: see it. */
type Options = {
  /** The jobs an acceptance holds busy: a time skips them as working. Its own when left out. */
  busy?: Busy;
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

/** The key of a time queued: a job in a repository, and the time. */
const queuedKey = ({ due, job, repo }: Due) => `${job.name}\0${repo.name}\0${due}`;

/** The key of a job in a repository, both by name. */
const keyOf = (job: string, repository: string) => `${job}\0${repository}`;

class JobScheduler implements Scheduler {
  readonly #options: Options;
  readonly #busy: Busy;
  readonly #now: () => Date;
  readonly #wait: (ms: number) => Promise<void>;
  readonly #timer: ReturnType<typeof setInterval> | undefined;
  #stopped = false;
  readonly #stop = new AbortController();
  // When this scheduler first saw each job on in each repository with its schedule, in ms (R2).
  readonly #seen = new Map<string, { first: number; schedule: string }>();
  // The job and repository (by its name) whose run starts now: a time and a run by hand never start two.
  readonly #starting = new Set<string>();
  readonly #printed = new Set<string>();
  readonly #flying = new Set<Promise<unknown>>();
  readonly #ticks = new Map<string, Runs>();
  // The times due and not started yet, in order, and the ones in it or being started.
  readonly #queue: Array<Due> = [];
  readonly #queued = new Set<string>();
  #draining: Promise<void> | undefined;

  constructor(options: Options) {
    this.#options = options;
    this.#busy = options.busy ?? new Busy();
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
    this.#enqueue(await this.#dueNow(jobs, this.#now()));
  }

  /** Queues the times not queued yet, and starts the queue's drain when it is not running. */
  #enqueue(items: Array<Due>): void {
    for (const item of items) {
      const key = queuedKey(item);
      if (!this.#queued.has(key)) {
        this.#queued.add(key);
        this.#queue.push(item);
      }
    }
    if (this.#queue.length > 0 && this.#draining === undefined) {
      this.#draining = this.#track(this.#drain());
    }
  }

  /**
   * Starts the queued times one after another, a minute after the last start, while the ticks go on
   * looking for times and queue them behind. A time skipped or recorded waits for nothing.
   */
  async #drain(): Promise<void> {
    try {
      let started = false;
      for (let item = this.#queue.shift(); item !== undefined; item = this.#queue.shift()) {
        try {
          started = (await this.#run(item, started)) || started;
        } finally {
          this.#queued.delete(queuedKey(item));
        }
        // The switch turned off, or the server stopping, starts no other.
        if (!this.#on()) {
          break;
        }
      }
    } finally {
      this.#queue.length = 0;
      this.#queued.clear();
      this.#draining = undefined;
    }
  }

  async settled(): Promise<void> {
    while (this.#draining !== undefined) {
      await this.#draining;
    }
  }

  /**
   * Where the job runs in the repository of this name, `undefined` when it does not: the job is on,
   * has no problem, the repository is listed with its extension on, and its agent is on there.
   */
  async #placeOf(job: Job, name: string, repos: Array<{ name: string; path: string }>) {
    const repo = repos.find((one) => one.name === name);
    if (
      !job.on ||
      job.problem !== undefined ||
      job.schedule === undefined ||
      !job.repositories.includes(name) ||
      repo === undefined ||
      !this.#options.isOn(name)
    ) {
      return undefined;
    }
    const ctx = this.#options.context(repo.path);
    const agent = agentOf(ctx, job, await ctx.sessions.mainRoot(repo.path));
    return agent && { agent, repo, schedule: job.schedule };
  }

  /** The times due now, in the repositories where each job runs. */
  async #dueNow(jobs: Jobs["jobs"], at: Date): Promise<Array<Due>> {
    const found: Array<Due> = [];
    const eligible = new Set<string>();
    const repos = this.#options.repos();
    for (const job of jobs) {
      for (const name of job.repositories) {
        const place = await this.#placeOf(job, name, repos);
        if (place === undefined) {
          continue;
        }
        const { agent, repo } = place;
        const due = dueAt(place.schedule, at).getTime();
        const key = keyOf(job.name, name);
        eligible.add(key);
        // A schedule edited is a job added: the moment it was seen starts again.
        const schedule = JSON.stringify(job.schedule);
        const seen = this.#seen.get(key);
        const first = seen?.schedule === schedule ? seen.first : at.getTime();
        this.#seen.set(key, { first, schedule });
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

  /**
   * The job as it is now, when its queued time still holds: the switch is on, the job exists, is on,
   * has no problem, runs the same schedule in the repository, and its extension and agent are on
   * there. The time's own age is not read: a tick saw it in time, and the queue's minutes do not
   * make it missed (R17). `undefined` drops the time, recording nothing.
   */
  async #fresh({ job, repo }: Due): Promise<Job | undefined> {
    if (!this.#on()) {
      return undefined;
    }
    const { jobs, problem } = await this.#options.jobs();
    const now = jobs.find((one) => one.name === job.name);
    if (problem !== undefined || now === undefined || !this.#on()) {
      return undefined;
    }
    const place = await this.#placeOf(now, repo.name, this.#options.repos());
    if (
      place === undefined ||
      place.repo.path !== repo.path ||
      !place.agent.available ||
      JSON.stringify(place.schedule) !== JSON.stringify(job.schedule)
    ) {
      return undefined;
    }
    return now;
  }

  /**
   * Why the job's time is skipped in the repository: its last run works, or an acceptance is opening
   * its change, or a change it started is open. The open-change read is awaited first, so the
   * synchronous reads of what works come last, as close to the start as they can.
   */
  async #skipOf(
    ctx: RepoContext,
    job: Job,
    root: string,
    open?: ReadonlySet<string>,
  ): Promise<Skipped | undefined> {
    const { jobs } = ctx.sessions.cache;
    // Any run of the job that started a change still open, not only the latest run.
    const folders = jobs.changeFolders(job.name, root);
    const opened = folders.length === 0 ? undefined : (open ?? (await openFolders(ctx)));
    const last = jobs.latestStarted(job.name, root);
    if (this.#busy.has(job.name, root) || (last?.session && works(ctx, last.session))) {
      return "working";
    }
    return opened !== undefined && folders.some((folder) => opened.has(folder))
      ? "change-open"
      : undefined;
  }

  /** Records a time skipped, once: the unique row of the time is what keeps it from a second. */
  #skip(ctx: RepoContext, job: string, root: string, due: number, reason: Skipped): void {
    ctx.sessions.cache.jobs.add({
      at: this.#now().getTime(),
      due,
      job,
      outcome: "skipped",
      reason,
      repository: root,
      session: null,
      trigger: "schedule",
    });
  }

  /**
   * Waits the minute between two starts. Returns whether the clock jumped meanwhile, which the
   * machine sleeping does: the wait took more than `MISSED_AFTER_MS` beyond its length, so the times
   * still queued are hours old and are dropped, recording nothing (R17).
   */
  async #waited(): Promise<boolean> {
    const before = this.#now().getTime();
    await this.#wait(APART_MS);
    return this.#now().getTime() - before > APART_MS + MISSED_AFTER_MS;
  }

  /**
   * Starts, or skips, one due time. Returns whether it started a session. The job's start in the
   * repository is reserved before anything is awaited, and held until it ends: a run by hand, or
   * the same time asked twice, finds it taken.
   */
  async #run({ due, job, repo }: Due, spaced: boolean): Promise<boolean> {
    const key = keyOf(job.name, repo.name);
    const taken = this.#starting.has(key);
    this.#starting.add(key);
    try {
      const ctx = this.#options.context(repo.path);
      const root = await ctx.sessions.mainRoot(repo.path);
      const runs = ctx.sessions.cache.jobs;
      // Read first: a time recorded already is nobody's to start or skip again.
      if (runs.recorded(job.name, root, due)) {
        return false;
      }
      const reason = taken ? "working" : await this.#skipOf(ctx, job, root);
      if (reason !== undefined) {
        this.#skip(ctx, job.name, root, due, reason);
        return false;
      }
      // A start comes a minute after the one before it, and the job may have changed meanwhile.
      if (spaced && (await this.#waited())) {
        return false;
      }
      const now = await this.#fresh({ due, job, repo });
      if (now === undefined) {
        return false;
      }
      // What the minute and the reads let change: right before the start, holding the reservation,
      // the last run may work again, or a change may be open (SC-003).
      const again = await this.#skipOf(ctx, now, root);
      if (again !== undefined) {
        this.#skip(ctx, job.name, root, due, again);
        return false;
      }
      const run = { at: this.#now().getTime(), due, trigger: "schedule" } as const;
      return (await startRun(ctx, now, run)) !== undefined;
    } catch (error) {
      const why = `the run of ${job.name} in ${repo.name} was refused: ${reasonOf(error)}`;
      this.#print(`${key}\0${due}`, why);
      return false;
    } finally {
      // The reservation of another start, which this one found, is that start's to release.
      if (!taken) {
        this.#starting.delete(key);
      }
    }
  }

  async nextRun(job: Job, repository: string, open?: ReadonlySet<string>): Promise<NextRun> {
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
      if ((await this.#skipOf(ctx, job, root, open)) === "change-open") {
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
    if (problem !== undefined) {
      throw refused(problem);
    }
    if (job === undefined) {
      throw refused(`There is no job named “${name}”.`);
    }
    // A run by hand reads no schedule: only what makes a run impossible refuses it.
    const why = impossible(jobs, job);
    if (why !== undefined) {
      throw refused(why);
    }
    if (repo === undefined || !job.repositories.includes(repository)) {
      throw refused(`“${name}” does not run in ${repository}.`);
    }
    const ctx = this.#options.context(repo.path);
    const root = await ctx.sessions.mainRoot(repo.path);
    const last = ctx.sessions.cache.jobs.latestStarted(name, root);
    const key = keyOf(name, repository);
    if (
      this.#stopped ||
      this.#starting.has(key) ||
      this.#busy.has(name, root) ||
      (last?.session && works(ctx, last.session))
    ) {
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
 * Starts the scheduler. A tick reads `jobs()`, and, while `enabled()`, queues each time due in a
 * repository of the list where the job is on, its extension is on, and its agent is available. The
 * queue starts them one after another, the first at once, each next after `wait(60_000)`, while the
 * ticks go on. A test gives the clock, `now`, and the waits, and ticks by itself with `every: null`.
 */
export function startScheduler(options: Options): Scheduler {
  return new JobScheduler(options);
}
