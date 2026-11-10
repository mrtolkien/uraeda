import { expect, test } from "vite-plus/test";
import { accountUsage, type UsageReport } from "../account-usage.ts";
import type { Account, AccountWindow } from "../adapter.ts";

const NOW = Date.UTC(2026, 10, 10, 12);
const HOUR = 3_600_000;
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString();

const five = (used: number, resetsAt: string | null = at(2)): AccountWindow => ({
  id: "five_hour",
  label: "5h",
  resetsAt,
  used,
});
const week = (used: number, resetsAt: string | null = at(72)): AccountWindow => ({
  id: "seven_day",
  label: "Week",
  resetsAt,
  used,
});
/** An account whose windows were read at `askedAt`: known, unless its last ask could not read it. */
const ask = (
  askedAt: number | null,
  windows: Array<AccountWindow>,
  known = askedAt !== null && windows.length > 0,
): Account => ({ askedAt, id: "/u/.claude-b", known, name: "b", state: "ready", windows });
const report = (time: number, window: AccountWindow, account = "/u/.claude-b"): UsageReport => ({
  account,
  at: time,
  window: { ...window, resetsAt: window.resetsAt ?? at(0) },
});

/** The windows, the `askedAt` and the `known` of the one account `accountUsage` gives. */
const merged = (account: Account, reports: Array<UsageReport>, now = NOW) => {
  const [one] = accountUsage([account], reports, now);
  return {
    askedAt: one!.askedAt,
    known: one!.known,
    windows: one!.windows.map(({ id, used }) => [id, used]),
  };
};

const BOTH = (fiveUsed: number, weekUsed: number) => [
  ["five_hour", fiveUsed],
  ["seven_day", weekUsed],
];

test.each([
  {
    account: ask(NOW - 5, [five(0.1), week(0.2)]),
    name: "no report leaves the ask",
    reports: [],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0.1, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0.1), week(0.2)]),
    name: "a report after the ask wins its window, and the ask's time stays",
    reports: [report(NOW - 1, five(0.3))],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0.3, 0.2) },
  },
  {
    account: ask(NOW - 1, [five(0.1), week(0.2)]),
    name: "an ask after the report wins",
    reports: [report(NOW - 5, five(0.3))],
    want: { askedAt: NOW - 1, known: true, windows: BOTH(0.1, 0.2) },
  },
  {
    account: ask(NOW - 1, [five(0.1), week(0.2)]),
    name: "an ask at the time of a report wins",
    reports: [report(NOW - 1, five(0.3))],
    want: { askedAt: NOW - 1, known: true, windows: BOTH(0.1, 0.2) },
  },
  {
    account: ask(NOW - 9, [five(0.1), week(0.2)]),
    name: "the newest of two reports wins",
    reports: [report(NOW - 1, five(0.5)), report(NOW - 3, five(0.4))],
    want: { askedAt: NOW - 9, known: true, windows: BOTH(0.5, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0.1), week(0.2)]),
    name: "each window takes its own freshest source",
    reports: [report(NOW - 9, five(0.4)), report(NOW - 1, week(0.25))],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0.1, 0.25) },
  },
  {
    account: ask(NOW - 5, [five(0.1), week(0.2)]),
    name: "a report of a window the ask never gave adds none",
    reports: [report(NOW - 1, { id: "opus", label: "Opus", resetsAt: at(10), used: 0.7 })],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0.1, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0.1), week(0.2)]),
    name: "another account's report, and one of no account, change nothing",
    reports: [
      report(NOW - 1, five(0.9), "/u/.claude-c"),
      { ...report(NOW - 1, five(0.8)), account: null },
    ],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0.1, 0.2) },
  },
  {
    // The 12:00 ask read 80%, the 12:01 ask failed: an open process's older report is not fresher.
    account: ask(NOW, [five(0.8), week(0.2)], false),
    name: "a failed ask keeps the time of its windows: an older report does not override them",
    reports: [report(NOW - HOUR, five(0.2))],
    want: { askedAt: NOW, known: false, windows: BOTH(0.8, 0.2) },
  },
  {
    account: ask(NOW - HOUR, [five(0.8), week(0.2)], false),
    name: "a report of the first window after a failed ask's windows wins, and makes it known",
    reports: [report(NOW - 5, five(0.2))],
    want: { askedAt: NOW - HOUR, known: true, windows: BOTH(0.2, 0.2) },
  },
  {
    account: ask(NOW - 24 * HOUR, [five(0.1), week(0.2)], false),
    name: "a report of the week alone, after a failed ask, leaves the account unknown",
    reports: [report(NOW - 4, week(0.6))],
    want: { askedAt: NOW - 24 * HOUR, known: false, windows: BOTH(0.1, 0.6) },
  },
  {
    account: ask(null, []),
    name: "an account whose ask never read windows stays unknown: its reports are set aside",
    reports: [report(NOW - 2, five(0.3)), report(NOW - 2, week(0.4))],
    want: { askedAt: null, known: false, windows: [] },
  },
  {
    account: ask(null, []),
    name: "a week-only report of a never-read account adds no window, so none stands as the first",
    reports: [report(NOW - 2, week(1))],
    want: { askedAt: null, known: false, windows: [] },
  },
  {
    account: ask(null, [five(0.1), week(0.2)], false),
    name: "windows with no time to them are older than any report",
    reports: [report(NOW - 4, five(0.5))],
    want: { askedAt: null, known: true, windows: BOTH(0.5, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0.9, at(-1)), week(0.2)]),
    name: "an ask's window whose reset has passed reads as unused",
    reports: [],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0.9, at(0)), week(0.2)]),
    name: "a window resetting at this very time reads as unused",
    reports: [],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0.1), week(0.2)]),
    name: "a report's window whose reset has passed reads as unused",
    reports: [report(NOW - 1, five(0.9, at(-1)))],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0, 0.2) },
  },
  {
    account: ask(NOW - HOUR, [five(0.1), week(0.2)], false),
    name: "an expired report of the first window still makes a failed ask's account known, unused",
    reports: [report(NOW - 5, five(0.9, at(-1)))],
    want: { askedAt: NOW - HOUR, known: true, windows: BOTH(0, 0.2) },
  },
  {
    account: ask(NOW - 5, [five(0, null), week(0.2)]),
    name: "a window not open stays not open",
    reports: [],
    want: { askedAt: NOW - 5, known: true, windows: BOTH(0, 0.2) },
  },
])("an account's usage: $name", ({ account, reports, want }) => {
  expect(merged(account, reports)).toEqual(want);
});

test("an expired window reads as unused with no reset, and keeps its label", () => {
  const [one] = accountUsage([ask(NOW - 5, [five(0.9, at(-1))])], [], NOW);
  expect(one?.windows).toEqual([{ id: "five_hour", label: "5h", resetsAt: null, used: 0 }]);
});
