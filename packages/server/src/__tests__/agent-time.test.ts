import { expect, test } from "vite-plus/test";

import { agentTime } from "../fate/agentTime.ts";
import type { TurnRow } from "../runner/cache.ts";

/** A turn, with only what the agent time reads. */
const turn = (over: Partial<TurnRow>) =>
  ({ endedAt: null, startedAt: null, state: "done", ...over }) as TurnRow;

test("ended turns add up: 52 min and 1 h 59 min are 2 h 51 min", () => {
  const turns = [
    turn({ endedAt: "2026-10-06T10:06:00Z", startedAt: "2026-10-06T09:14:00Z", state: "done" }),
    turn({ endedAt: "2026-10-06T15:14:00Z", startedAt: "2026-10-06T13:15:00Z", state: "done" }),
  ];
  expect(agentTime(turns)).toEqual({ runningSince: null, seconds: 10_260 });
});

test("a running turn is not summed but named, so the browser counts it to now", () => {
  const running = turn({ endedAt: null, startedAt: "2026-10-06T15:10:00Z", state: "running" });
  expect(agentTime([running])).toEqual({ runningSince: "2026-10-06T15:10:00Z", seconds: 0 });
});

test("a failed turn with no end adds nothing, and does not count as running", () => {
  const crashed = turn({ endedAt: null, startedAt: "2026-10-06T15:10:00Z", state: "failed" });
  expect(agentTime([crashed])).toEqual({ runningSince: null, seconds: 0 });
});

test("no turn with a start is null, which the page reads as Not recorded", () => {
  expect(agentTime([turn({ startedAt: null, state: "queued" })])).toBeNull();
  expect(agentTime([])).toBeNull();
});
