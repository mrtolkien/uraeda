/**
 * The benchmark's results: one row per time, against its criterion's target, 100 ms or 1 second,
 * printed as a table once the run ends.
 */
import type { Page } from "playwright";
import type { Measured, ServerTimes } from "./performance-probe.ts";

/** The success criteria, and each one's target in milliseconds. */
export const TARGETS = {
  "SC-001": 100,
  "SC-002": 1000,
  "SC-003": 100,
  "SC-004": 100,
  "SC-005": 1000,
  "SC-006": 100,
} as const;

export type Criterion = keyof typeof TARGETS;

/** A row of the table: what was timed, its time, and the server's share. */
type Row = {
  criterion: Criterion;
  ms: number | null;
  note: string;
  passed: boolean;
  project: string;
  server: string;
  what: string;
};

/** What a case runs with: the page, its server's timings, and the report it adds rows to. */
export type Run = { page: Page; project: string; report: Report; server: ServerTimes };

export class Report {
  readonly rows: Array<Row> = [];

  /**
   * Adds a measure's row: its time is the latest of its conditions', and a condition that never
   * showed, or "Loading…" shown meanwhile, misses the target.
   */
  add(criterion: Criterion, project: string, what: string, measured: Measured) {
    const times = Object.entries(measured.times);
    const missing = times.filter(([, ms]) => ms === null).map(([name]) => name);
    const ms = missing.length > 0 ? null : Math.max(...times.map(([, ms]) => ms ?? 0));
    const notes = [
      ...(missing.length > 0 ? [`never drawn: ${missing.join(", ")}`] : []),
      ...(times.length > 1 ? times.map(([name, ms]) => `${name} ${ms ?? "–"}`) : []),
      ...(measured.loading ? ["showed Loading…"] : []),
    ];
    const row: Row = {
      criterion,
      ms,
      note: notes.join("; "),
      passed: ms !== null && ms <= TARGETS[criterion] && !measured.loading,
      project,
      server: `${measured.server}; long tasks ${measured.busy} ms`,
      what,
    };
    this.rows.push(row);
    process.stdout.write(`${line(row)}\n`);
  }

  /** Prints the table, and returns whether every row met its target. */
  print(): boolean {
    process.stdout.write(`\n${header()}\n${this.rows.map(line).join("\n")}\n\n`);
    const missed = this.rows.filter(({ passed }) => !passed);
    for (const criterion of Object.keys(TARGETS) as Array<Criterion>) {
      const rows = this.rows.filter((row) => row.criterion === criterion);
      const failed = rows.filter(({ passed }) => !passed).length;
      const worst = Math.max(...rows.map(({ ms }) => ms ?? Infinity));
      process.stdout.write(
        `${criterion} (${TARGETS[criterion]} ms): ${rows.length - failed}/${rows.length} within, ` +
          `worst ${rows.length === 0 ? "–" : worst === Infinity ? "never drawn" : `${worst} ms`}\n`,
      );
    }
    return missed.length === 0 && this.rows.length > 0;
  }
}

/** The table's columns: their titles and widths. */
const COLUMNS = [
  ["criterion", 9],
  ["project", 10],
  ["what", 44],
  ["ms", 6],
  ["target", 6],
  ["", 4],
  ["server; browser", 70],
] as const;

function cells(values: Array<string>): string {
  return values
    .map((value, at) => {
      const width = COLUMNS[at]![1];
      const cut = value.length > width ? `${value.slice(0, width - 1)}…` : value;
      return at === 3 || at === 4 ? cut.padStart(width) : cut.padEnd(width);
    })
    .join(" ")
    .trimEnd();
}

function header(): string {
  return cells(COLUMNS.map(([title]) => title));
}

function line(row: Row): string {
  const values = [
    row.criterion,
    row.project,
    row.what,
    row.ms === null ? "–" : String(row.ms),
    String(TARGETS[row.criterion]),
    row.passed ? "ok" : "MISS",
    row.server,
  ];
  return `${cells(values)}${row.note === "" ? "" : `  (${row.note})`}`;
}
