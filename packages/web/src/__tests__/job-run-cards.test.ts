// The card a started run has in a job's history: its change's, else its session's, as the sidebar
// reads them, and none once both are gone, which the history then says in a line of its own.
import { expect, test } from "vite-plus/test";
import { runCardOf } from "../jobs/runCards.ts";
import type { Feature, Row } from "../sidebar/cards.ts";

const run = (session: string | null, folder: string | null) => ({
  at: "2026-11-10T03:00:00.000Z",
  blockedBy: null,
  due: null,
  error: null,
  folder,
  id: "1",
  outcome: "started" as const,
  reason: null,
  session,
  title: null,
  trigger: "schedule" as const,
});

const row = { folder: null, id: "s1" } as unknown as Row;
const feature = { folder: "2026-11-10-upgrade", status: { session: "s1" } } as unknown as Feature;

test("a run's card is its change's, else its session's", () => {
  expect(runCardOf(run("s1", "2026-11-10-upgrade"), [row], [feature])).toEqual({
    feature,
    row,
  });
  expect(runCardOf(run("s1", null), [row], [])).toEqual({ feature: undefined, row });
});

test("a run whose session and change are gone has no card", () => {
  expect(runCardOf(run("s9", null), [row], [feature])).toBeUndefined();
  expect(runCardOf(run(null, null), [row], [feature])).toBeUndefined();
  expect(runCardOf(run("s9", "2026-11-09-merged"), [row], [feature])).toBeUndefined();
});
