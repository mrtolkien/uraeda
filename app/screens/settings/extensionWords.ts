// The Extensions category's words: where an extension is on, where it comes from, and the banners
// above the rows, one per problem, its accounts' included ("Claude Code: account b is signed out,
// in ~/.claude-b"), and the turn a reload waits for.
import type { ExtensionProblem, ExtensionRow } from "../../store/protocol";

/** Where an extension is on: every repository, or the repositories named, none when off. */
export type OnIn = "all" | ReadonlyArray<string>;

/** The built-in scripted agent, listed only where it runs: tests and the sandbox. */
const FAKE = "fake";

/** The extensions listed: all but the fake agent while it is off, where its switch does nothing. */
export const listed = (rows: ReadonlyArray<ExtensionRow>) =>
  rows.filter((row) => !(row.isBuiltIn && row.name === FAKE && row.state === "off"));

/** Where it is on, as the record says. */
export const onInOf = (row: ExtensionRow): OnIn => (row.onAll ? "all" : row.on);

/** Whether it is on anywhere. */
export const isOn = (on: OnIn) => on === "all" || on.length > 0;

/** Where it is on, in words: "every repository", "uraeda only", "no repository". */
export function onInWords(on: OnIn): string {
  if (on === "all") return "every repository";
  if (on.length === 0) return "no repository";
  return on.length === 1 ? `${on[0]} only` : on.join(", ");
}

/** The line under its description: its version and source, and where it is on. */
export function aboutLine(row: ExtensionRow, on: OnIn): string {
  if (row.isBuiltIn) return `Built in · on in ${onInWords(on)}`;
  const from = row.source
    ? `${row.source.url} at ${row.source.commit.slice(0, 7)}`
    : row.isLinked
      ? "reloads on save"
      : "";
  return [row.version, from, `on in ${onInWords(on)}`].filter((one) => one !== "").join(" · ");
}

/** A banner of the category: its words and its tone. */
export type Notice = { id: string; title: string; tone: "danger" | "caution" | "info" };

const API_MISMATCH = /^built for extension API /;

/** Where a problem is: its file and line, nothing for the folder itself or an account's. */
function whereOf({ file, line }: ExtensionProblem): string {
  if (file === "") return "";
  return line === null ? `${file}: ` : `${file}, line ${line}: `;
}

/**
 * What the category says of an extension above its rows: each problem, its accounts' among them,
 * as why it is off when it does not run; then the turn its reload waits for.
 */
export function noticesOf(row: ExtensionRow): Array<Notice> {
  const isOff = row.state === "broken" || row.state === "off";
  const notices: Array<Notice> = row.problems.map((problem, at) => {
    const isApi = API_MISMATCH.test(problem.message);
    const lead = isOff ? `${row.title} is off: ` : `${row.title}: `;
    return {
      id: `${row.name}#${at}`,
      title: `${lead}${isApi ? "" : whereOf(problem)}${problem.message}`,
      tone: isApi || !isOff ? "caution" : "danger",
    };
  });
  if (row.waitingFor !== null) {
    notices.push({
      id: `${row.name}#waiting`,
      title: `${row.title} reloads when the turn of “${row.waitingFor}” ends`,
      tone: "info",
    });
  }
  return notices;
}

/** A JSON object, none when it is no object. */
export function objectOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
