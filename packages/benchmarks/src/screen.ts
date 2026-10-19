import { join } from "node:path";
import { basename, dirname } from "node:path";
import { type Case, readCase } from "./case.ts";
import { listRuns } from "./recorder.ts";
import type { Deps, RunTarget } from "./deps.ts";
import { runVerifier } from "./grader.ts";
import { requireApproval } from "./run-common.ts";
import { runPlain } from "./run-plain.ts";
import type { Suite } from "./suite.ts";

export type Screened = { case: Case; tests: { passed: number; resolved: boolean; total: number } };

/** `owner/repo` of a case's upstream, which counts the repositories a suite spans. */
export const repositoryOf = (found: Case) =>
  new URL(found.upstream).pathname.replaceAll(/^\/|\.git$/g, "");

const share = ({ tests }: Screened) => (tests.total === 0 ? 0 : tests.passed / tests.total);

/**
 * The suite's cases from the screening: the ones the plain arm failed, the lowest share of passed
 * tests first and one per repository before a second, and only when too few failed, passing ones
 * to fill, named in `filled`. `repositories` says how many repositories the choice spans.
 */
export function chooseCases(
  results: Array<Screened>,
  count = 5,
): { chosen: Array<Case>; filled: Array<string>; repositories: number } {
  const failed = results
    .filter((result) => !result.tests.resolved)
    .toSorted((a, b) => share(a) - share(b));
  const chosen: Array<Screened> = [];
  const seen = new Set<string>();
  for (const result of failed) {
    if (chosen.length < count && !seen.has(repositoryOf(result.case))) {
      seen.add(repositoryOf(result.case));
      chosen.push(result);
    }
  }
  for (const result of failed) {
    if (chosen.length < count && !chosen.includes(result)) {
      chosen.push(result);
    }
  }
  const passing = results.filter((result) => result.tests.resolved);
  chosen.push(...passing.slice(0, Math.max(0, count - chosen.length)));
  return {
    chosen: chosen.map((result) => result.case),
    filled: chosen.filter((result) => result.tests.resolved).map((result) => result.case.id),
    repositories: new Set(chosen.map((result) => repositoryOf(result.case))).size,
  };
}

/**
 * Screens candidates: the task's reference patch must pass its tests in the image, else the case
 * is dropped; then one plain run each, recorded in the suite folder `screening`: a run that did not
 * finish (a command that does not start in the image, the usage limit) is reported in `unrun`, not
 * counted as a failure. The cases it keeps are `chooseCases`'s.
 */
export async function screen(
  deps: Deps & { fetchGold: (task: string) => Promise<string> },
  options: RunTarget & {
    candidates: Array<Case>;
    suite: Pick<Suite, "effort" | "human" | "model">;
  },
): Promise<{ dropped: Array<string>; results: Array<Screened>; unrun: Array<string> }> {
  requireApproval(options.approvedBy);
  const dropped: Array<string> = [];
  const unrun: Array<string> = [];
  const results: Array<Screened> = [];
  for (const candidate of options.candidates) {
    const reference = await runVerifier({
      case: candidate,
      ...(deps.docker ? { docker: deps.docker } : {}),
      fetchTests: deps.fetchTests,
      patch: await deps.fetchGold(candidate.task),
    });
    if (!reference.resolved) {
      dropped.push(candidate.id);
      continue;
    }
    const { outcome, tests } = await runPlain(deps, {
      approvedBy: options.approvedBy,
      case: candidate,
      suite: options.suite,
      suiteName: "screening",
    });
    // A session that did not run says nothing about the task: it is left out, not counted as failed.
    if (outcome === "finished") {
      results.push({ case: candidate, tests });
    } else {
      unrun.push(candidate.id);
    }
  }
  return { dropped, results, unrun };
}

/** The screening runs on disk for these cases, the last of each, as screened candidates. */
export function screenedRuns(root: string, cases: Array<string>): Array<Screened> {
  const runs = listRuns(root).filter(
    (run) => basename(dirname(run.folder)).endsWith("-screening") && run.scores !== undefined,
  );
  return cases.flatMap((id) => {
    const last = runs.filter((run) => basename(run.folder).startsWith(`${id}--plain--`)).at(-1);
    return last?.scores
      ? [{ case: readCase(join(root, "cases", id)), tests: last.scores.tests }]
      : [];
  });
}
