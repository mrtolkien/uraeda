// The problems extensions' pages report from the browser: a page that threw while registering, or
// a contribution that threw while drawing. They are kept for the page's version only, so the next
// version starts without them, and bounded, so a page throwing in a loop holds little.
import type { Problem } from "./graph.ts";

/** The most problems kept for one version of a page. */
const MOST_PROBLEMS = 10;
/** The longest message kept, in characters. */
const LONGEST_MESSAGE = 1000;

export class PageProblems {
  readonly #byExtension = new Map<string, { problems: Array<Problem>; version: number }>();

  /**
   * Keeps `message` for the version `version` of the extension's page, whose entry is `file`:
   * gives whether it was new. A report for another version than `current`, the one running, is
   * dropped: it comes from a page that has not loaded the new version yet.
   */
  report(
    name: string,
    report: { current: number | undefined; file: string; message: string; version: number },
  ): boolean {
    const { current, file, version } = report;
    if (current !== version) {
      return false;
    }
    const message = report.message.slice(0, LONGEST_MESSAGE);
    const kept = this.#byExtension.get(name);
    const problems = kept?.version === version ? kept.problems : [];
    if (problems.length >= MOST_PROBLEMS || problems.some((one) => one.message === message)) {
      return false;
    }
    this.#byExtension.set(name, { problems: [...problems, { file, message }], version });
    return true;
  }

  /** The problems the page of the extension reported at `version`, none for another. */
  of(name: string, version: number | null): ReadonlyArray<Problem> {
    const kept = this.#byExtension.get(name);
    return kept !== undefined && kept.version === version ? kept.problems : [];
  }
}
