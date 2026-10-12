// The runner's records, read from its cache: runs, their log pages, and the runner itself.
import type { FeatureView } from "uraeda-binding";
import type { RunCache, RunRow } from "../runner/cache.ts";
import { REFUSALS } from "../runner/runner.ts";
import type { Context } from "./context.ts";
import { callSiteError } from "./errors.ts";
import {
  type FeatureRecord,
  RUNNER_ID,
  type RunLogRecord,
  type RunnerRecord,
  type RunRecord,
} from "./views.ts";

/** The events in each page of a run's log. */
export const LOG_PAGE = 100;

export function runnerRecord({ runner }: Context): RunnerRecord {
  return { id: RUNNER_ID, ...runner.status() };
}

/** The count of the run's log pages. */
export function pages(cache: RunCache, runId: number): number {
  return Math.ceil(cache.eventCount(runId) / LOG_PAGE);
}

export function runRecord(cache: RunCache, row: RunRow): RunRecord {
  return {
    id: String(row.id),
    folder: row.folder,
    trigger: row.trigger,
    step: row.step,
    state: row.state,
    reason: row.reason,
    costUsd: row.costUsd,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    newSession: row.newSession,
    allowed: row.allowed,
    pages: pages(cache, row.id),
    denials: cache
      .eventsOf(row.id, "denial")
      .map(({ seq, tool, target, rule }) => ({ seq, tool, target: target ?? null, rule })),
  };
}

/**
 * The run of this ID, or undefined when the cache has none for the server's repository: the cache
 * holds the runs of every repository.
 */
export async function readRun(ctx: Context, id: string): Promise<RunRecord | undefined> {
  const row = await ownRun(ctx, id);
  return row ? runRecord(ctx.runner.cache, row) : undefined;
}

/** A page of a run's log, by its ID, `<run>:<page>`, for a run of the server's repository. */
export async function readRunLog(ctx: Context, id: string): Promise<RunLogRecord | undefined> {
  const match = /^(\d+):(\d+)$/.exec(id);
  if (!match || !(await ownRun(ctx, match[1]))) {
    return undefined;
  }
  const [run, page] = [Number(match[1]), Number(match[2])];
  return {
    id,
    run: String(run),
    page,
    events: ctx.runner.cache.events(run, page * LOG_PAGE, LOG_PAGE),
  };
}

/** The run of this ID, when it is one of the server's repository. */
async function ownRun(ctx: Context, id: string): Promise<RunRow | undefined> {
  const row = /^\d+$/.test(id) ? ctx.runner.cache.run(Number(id)) : undefined;
  if (!row) {
    return undefined;
  }
  // A folder the repository does not have gives no main checkout: the run is another's.
  const root = await mainRoot(ctx, row.folder).catch(() => undefined);
  return root === row.repo ? row : undefined;
}

/**
 * The main checkout of each repository the server opened, which keys the cache's rows. The core
 * gives it with a feature's next step; it does not change while the server runs.
 */
const mainRoots = new Map<string, Promise<string>>();

function mainRoot({ binding, repo }: Context, folder: string): Promise<string> {
  let root = mainRoots.get(repo);
  if (!root) {
    root = binding.nextStep(repo, folder).then((next) => next.mainRoot);
    mainRoots.set(repo, root);
    root.catch(() => mainRoots.delete(repo));
  }
  return root;
}

/** A feature's record: its view, with the IDs of its runs, newest first. */
export async function featureRecord(ctx: Context, feature: FeatureView): Promise<FeatureRecord> {
  const runs = await mainRoot(ctx, feature.folder).then(
    (root) => ctx.runner.cache.runs(root, feature.folder).map((run) => String(run.id)),
    // A feature the core cannot give a step for has no runs to show.
    () => [],
  );
  return { id: feature.folder, ...feature, runs };
}

/**
 * Refuses a write to a feature while an agent works on it, before the binding is called. `path` is
 * a file's path from the top level: a feature's when it is under `specs/<folder>/` or
 * `specs/bugs/<folder>/`.
 */
export function writable(ctx: Context, target: { folder: string } | { path: string }): void {
  const folder =
    "folder" in target
      ? target.folder
      : (/^specs\/bugs\/([^/]+)\//.exec(target.path) ?? /^specs\/([^/]+)\//.exec(target.path))?.[1];
  if (folder !== undefined && ctx.runner.running(ctx.repo).includes(folder)) {
    throw callSiteError(`refused: ${REFUSALS.working}`);
  }
}
