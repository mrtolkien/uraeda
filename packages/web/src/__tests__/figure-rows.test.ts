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
