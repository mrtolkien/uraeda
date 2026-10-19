import type { Case } from "./case.ts";
import type { Deps, RunTarget } from "./deps.ts";
import { runVerifier } from "./grader.ts";
import { runPlain } from "./run-plain.ts";
import type { Suite } from "./suite.ts";

export type Screened = { case: Case; tests: { passed: number; resolved: boolean; total: number } };

/** `owner/repo` of a case's upstream, which counts the repositories a suite spans. */
export const repositoryOf = (found: Case) =>
  new URL(found.upstream).pathname.replaceAll(/^\/|\.git$/g, "");

const share = ({ tests }: Screened) => (tests.total === 0 ? 0 : tests.passed / tests.total);

/**
 * The suite's cases from the screening: the ones the plain arm failed, and, when too few failed,
 * the ones with the lowest share of passed tests, named in `filled`. Each repository comes first
 * once, so the suite spans as many as the candidates allow.
 */
export function chooseCases(
  results: Array<Screened>,
  count = 5,
): { chosen: Array<Case>; filled: Array<string>; repositories: number } {
  const ordered = results.toSorted(
    (a, b) => Number(a.tests.resolved) - Number(b.tests.resolved) || share(a) - share(b),
  );
  const chosen: Array<Screened> = [];
  const seen = new Set<string>();
  for (const result of ordered) {
    if (chosen.length < count && !seen.has(repositoryOf(result.case))) {
      seen.add(repositoryOf(result.case));
      chosen.push(result);
    }
  }
  for (const result of ordered) {
    if (chosen.length < count && !chosen.includes(result)) {
      chosen.push(result);
    }
  }
  return {
    chosen: chosen.map((result) => result.case),
    filled: chosen.filter((result) => result.tests.resolved).map((result) => result.case.id),
    repositories: new Set(chosen.map((result) => repositoryOf(result.case))).size,
  };
}

/**
 * Screens candidates: the task's reference patch must pass its tests in the image, else the case
 * is dropped; then one plain run each, recorded in the suite folder `screening`. The cases it
 * keeps are `chooseCases`'s.
 */
export async function screen(
  deps: Deps & { fetchGold: (task: string) => Promise<string> },
  options: RunTarget & {
    candidates: Array<Case>;
    suite: Pick<Suite, "effort" | "human" | "model">;
  },
): Promise<{ dropped: Array<string>; results: Array<Screened> }> {
  const dropped: Array<string> = [];
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
    const { tests } = await runPlain(deps, {
      approvedBy: options.approvedBy,
      case: candidate,
      suite: options.suite,
      suiteName: "screening",
    });
    results.push({ case: candidate, tests });
  }
  return { dropped, results };
}
