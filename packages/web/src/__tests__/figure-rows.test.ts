// The figures of the Home's column, as rows: what each reads, in which order, and where it leads.
// Times are read in UTC (`vite.config.ts`).
import { expect, test } from "vite-plus/test";
import { figureRows, tokenCount, type FiguresHistory } from "../feature/figureRows.ts";

const HISTORY: FiguresHistory = {
  decisions: [],
  found: true,
  lines: { added: 1204, files: 23, removed: 310 },
  questions: 7,
  rounds: 1,
  stages: [
    { name: "proposal", started: "2026-10-06T09:12:00Z" },
    { name: "build", started: "2026-10-06T14:40:00Z" },
  ],
  totalSeconds: null,
};

const LIVE = {
  agent: null,
  change: false,
  done: false,
  history: HISTORY,
  now: Date.parse("2026-10-06T15:14:00Z"),
  pullRequest: undefined,
  tokens: null,
};

/** A row's value, by its label. */
const valueOf = (rows: ReturnType<typeof figureRows>, label: string) =>
  rows.find((row) => row.label === label)?.value;

/** US3.1 */
test("agent time and elapsed read 2 h 51 min and 6 h 02 min", () => {
  const rows = figureRows({ ...LIVE, agent: { runningSince: null, seconds: 10_260 } });
  expect(valueOf(rows, "agent time")).toBe("2 h 51 min");
  // Started 09:12, now 15:14.
  expect(valueOf(rows, "elapsed")).toBe("6 h 02 min");
});

/** US3 more 1: a summed running turn would be counted twice */
test("a running turn counts to now", () => {
  const rows = figureRows({
    ...LIVE,
    agent: { runningSince: "2026-10-06T15:10:00Z", seconds: 600 },
  });
  // The 10 min ended turns, and the 4 min the running one has gone.
  expect(valueOf(rows, "agent time")).toBe("14 min");
  const later = figureRows({
    ...LIVE,
    agent: { runningSince: "2026-10-06T15:10:00Z", seconds: 600 },
    now: LIVE.now + 60_000,
  });
  expect(valueOf(later, "agent time")).toBe("15 min");
});

/** US3 more 2: "0 min" would say the agent did not work */
test("no agent is Not recorded", () => {
  expect(valueOf(figureRows(LIVE), "agent time")).toBe("Not recorded");
});

/** Review focus: no proposal start */
test("no start of the proposal means no elapsed row", () => {
  const history = { ...HISTORY, stages: [{ name: "proposal", started: null }] };
  const rows = figureRows({ ...LIVE, history });
  expect(rows.map((row) => row.label)).not.toContain("elapsed");
  expect(rows.map((row) => row.label)).toContain("agent time");
});

test("a live feature reads lines, tokens, agent time, and elapsed, the lines leading to the stages", () => {
  const rows = figureRows(LIVE);
  expect(rows.map((row) => row.label)).toEqual(["lines", "tokens", "agent time", "elapsed"]);
  expect(rows[0]).toMatchObject({
    caption: "23 files",
    href: "#stages",
    value: { added: 1204, removed: 310 },
  });
  expect(valueOf(rows, "tokens")).toBe("Not recorded");
});

/** US3.3 */
test("a done feature reads total time, questions and decisions leading to the record", () => {
  const history: FiguresHistory = {
    ...HISTORY,
    decisions: [{}],
    stages: [
      { name: "proposal", started: "2026-10-06T09:12:00Z" },
      { name: "pull-request", started: "2026-10-06T18:47:00Z" },
    ],
    totalSeconds: 34_500,
  };
  const rows = figureRows({
    ...LIVE,
    agent: { runningSince: null, seconds: 13_440 },
    done: true,
    history,
    pullRequest: "https://github.com/o/r/pull/31",
    tokens: { input: 6_800_000, output: 151_000, partial: false, since: "2026-10-06" },
  });
  expect(rows.map((row) => row.label)).toEqual([
    "total time",
    "lines",
    "tokens",
    "agent time",
    "questions",
    "decisions",
  ]);
  expect(rows[0]).toMatchObject({
    caption: "09:12 to 18:47",
    href: "#stages",
    value: "9 h 35 min",
  });
  expect(rows[1]!.href).toBe("https://github.com/o/r/pull/31/files");
  expect(rows[2]).toMatchObject({
    caption: "cache reads left out",
    value: { lines: ["6.8 M in", "151 k out"] },
  });
  expect(valueOf(rows, "agent time")).toBe("3 h 44 min");
  expect(rows[4]).toMatchObject({ caption: "1 round", href: "#record-questions", value: "7" });
  expect(rows[5]).toMatchObject({ href: "#record-decisions", value: "1" });
});

test("a change shows questions and decisions only when it has some", () => {
  const history = { ...HISTORY, questions: 0, rounds: 0 };
  const rows = figureRows({ ...LIVE, change: true, done: true, history });
  expect(rows.map((row) => row.label)).not.toContain("questions");
  expect(rows.map((row) => row.label)).not.toContain("decisions");
});

test("a feature at zero questions leads nowhere", () => {
  const history = { ...HISTORY, questions: 0, rounds: 0 };
  const rows = figureRows({ ...LIVE, done: true, history });
  expect(rows.find((row) => row.label === "questions")).toMatchObject({
    caption: "no round",
    value: "0",
  });
  expect(rows.find((row) => row.label === "questions")?.href).toBeUndefined();
});

test("a done feature whose commits were not traced has no rows", () => {
  expect(figureRows({ ...LIVE, done: true, history: { ...HISTORY, found: false } })).toEqual([]);
});

/** US2.2 */
test("token counts read compact, rounded to one decimal, units in words' case", () => {
  expect(tokenCount(999)).toBe("999");
  expect(tokenCount(1000)).toBe("1 k");
  expect(tokenCount(2712)).toBe("2.7 k");
  expect(tokenCount(99_950)).toBe("100 k");
  expect(tokenCount(113_407)).toBe("113 k");
  expect(tokenCount(999_950)).toBe("1 M");
  expect(tokenCount(5_177_416)).toBe("5.2 M");
});
