// The Extensions section's words: each extension as a row of the search, where it is on, where it
// comes from, and what the page says of it above the rows, a banner each: why it is off, what is
// wrong with it, the turn its reload waits for, and the keys another extension took first.
import type { Extensions } from "uraeda-server/fate";
import type { Category, IconName, Setting } from "./categories.ts";

/** An extension, as the `Extensions` record lists it. */
export type ExtensionRow = Extensions["extensions"][number];

/** A key of an extension's another took first: `keys` as registered, `takenBy` its title. */
export type KeyClash = { keys: string; takenBy: string };

/** Where an extension is on: every repository, or the repositories named, none when off. */
export type OnIn = "all" | ReadonlyArray<string>;

/** The built-in scripted agent, listed only where it runs: tests and the sandbox. */
const FAKE = "fake";

/** The icon of an extension, the plug when its manifest names none. */
export const iconOf = (row: ExtensionRow): IconName =>
  (row.icon === "" ? "uraeda:plug" : row.icon) as IconName;

/**
 * The extensions the section lists: all but the fake agent while it is off, as it is outside tests
 * and the sandbox, where its switch would do nothing.
 */
export function listed(rows: ReadonlyArray<ExtensionRow>): ReadonlyArray<ExtensionRow> {
  return rows.filter((row) => !(row.isBuiltIn && row.name === FAKE && row.state === "off"));
}

/** An extension as a row of the search: its title, its description, its name and its settings'. */
export function extensionSetting(row: ExtensionRow): Setting {
  return {
    help: row.description,
    icon: iconOf(row),
    label: row.title,
    terms: [row.name, ...row.settings.map((setting) => setting.label)],
  };
}

/** The Extensions category with a row for each extension listed, for the search to filter. */
export function extensionsCategory(
  category: Category,
  rows: ReadonlyArray<ExtensionRow>,
): Category {
  return { ...category, settings: listed(rows).map(extensionSetting) };
}

/** Where an extension is on, in words: "every repository", "uraeda only", "no repository". */
export function onInWords({ on, onAll }: Pick<ExtensionRow, "on" | "onAll">): string {
  if (onAll) {
    return "every repository";
  }
  if (on.length === 0) {
    return "no repository";
  }
  return on.length === 1 ? `${on[0]} only` : on.join(", ");
}

/**
 * The line under an extension's description: its version, where it comes from, and where it is
 * on. A built-in has neither version nor source.
 */
export function aboutLine(row: ExtensionRow): string {
  if (row.isBuiltIn) {
    return `On in ${onInWords(row)}`;
  }
  const from = row.source
    ? `${row.source.url} at ${row.source.commit.slice(0, 7)}`
    : "reloads on save";
  return [row.version, from, `on in ${onInWords(row)}`].filter((part) => part !== "").join(" · ");
}

/** A part of a notice's text: words, or keys drawn as keys. */
export type NoticePart = string | { keys: string };

/** A banner of the section: its status and its text. */
export type Notice = {
  id: string;
  parts: ReadonlyArray<NoticePart>;
  status: "error" | "info" | "warning";
};

const API_MISMATCH = /^built for extension API /;

/** Where a problem is: its file and line, nothing for the folder itself. */
function whereOf({ file, line }: ExtensionRow["problems"][number]): string {
  if (file === "") {
    return "";
  }
  return line === null ? `${file}: ` : `${file}, line ${line}: `;
}

/** The keys of a clash as the leader menu shows them after Space: `space y` reads `y`. */
const shownKeys = (keys: string) => keys.replace(/^space /, "");

/**
 * What the page says of an extension above the rows: each problem, as why it is off when it does
 * not run; the turn its reload waits for; and each key another took first, from the record or the
 * page's registry (`clashes`).
 */
export function noticesOf(row: ExtensionRow, clashes: ReadonlyArray<KeyClash> = []): Array<Notice> {
  const isOff = row.state === "broken" || row.state === "off";
  const notices: Array<Notice> = row.problems.map((problem, index) => {
    const isApi = API_MISMATCH.test(problem.message);
    const lead = isOff ? `${row.title} is off: ` : `${row.title}: `;
    return {
      id: `${row.name}#problem-${index}`,
      parts: [`${lead}${isApi ? "" : whereOf(problem)}${problem.message}`],
      status: isApi || !isOff ? "warning" : "error",
    };
  });
  if (row.waitingFor !== null) {
    notices.push({
      id: `${row.name}#waiting`,
      parts: [`${row.title} reloads when the turn of “${row.waitingFor}” ends`],
      status: "info",
    });
  }
  for (const clash of [...row.keys, ...clashes]) {
    notices.push({
      id: `${row.name}#key-${clash.keys}`,
      parts: [`${row.title}: `, { keys: shownKeys(clash.keys) }, ` is taken by ${clash.takenBy}`],
      status: "warning",
    });
  }
  return notices;
}

/** The extensions' records with one's `on` changed, as the page shows it while it is sent. */
export function withOn(
  rows: ReadonlyArray<ExtensionRow>,
  name: string,
  on: OnIn,
): Array<ExtensionRow> {
  return rows.map((row) =>
    row.name === name ? { ...row, on: on === "all" ? [] : [...on], onAll: on === "all" } : row,
  );
}

/** An extension's settings for every repository, from the record's JSON; none when unreadable. */
export function valuesOf(row: ExtensionRow): Record<string, unknown> {
  try {
    const values: unknown = JSON.parse(row.values);
    return typeof values === "object" && values !== null ? (values as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
