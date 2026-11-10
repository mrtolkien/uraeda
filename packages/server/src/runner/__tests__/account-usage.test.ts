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
const ask = (askedAt: number | null, ...windows: Array<AccountWindow>): Account => ({
  askedAt,
  id: "/u/.claude-b",
  name: "b",
  state: "ready",
  windows,
});
const report = (time: number, window: AccountWindow, account = "/u/.claude-b"): UsageReport => ({
  account,
  at: time,
  window: { ...window, resetsAt: window.resetsAt ?? at(0) },
});

/** The windows and the `askedAt` of the one account `accountUsage` gives. */
const merged = (account: Account, reports: Array<UsageReport>, now = NOW) => {
  const [one] = accountUsage([account], reports, now);
  return { askedAt: one!.askedAt, windows: one!.windows.map(({ id, used }) => [id, used]) };
};

test.each([
  {
    account: ask(NOW - 5, five(0.1), week(0.2)),
    name: "no report leaves the ask",
    reports: [],
    want: {
      askedAt: NOW - 5,
      windows: [
        ["five_hour", 0.1],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0.1), week(0.2)),
    name: "a report after the ask wins its window, and its time is the account's",
    reports: [report(NOW - 1, five(0.3))],
    want: {
      askedAt: NOW - 1,
      windows: [
        ["five_hour", 0.3],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 1, five(0.1), week(0.2)),
    name: "an ask after the report wins",
    reports: [report(NOW - 5, five(0.3))],
    want: {
      askedAt: NOW - 1,
      windows: [
        ["five_hour", 0.1],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 1, five(0.1), week(0.2)),
    name: "an ask at the time of a report wins",
    reports: [report(NOW - 1, five(0.3))],
    want: {
      askedAt: NOW - 1,
      windows: [
        ["five_hour", 0.1],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 9, five(0.1), week(0.2)),
    name: "the newest of two reports wins",
    reports: [report(NOW - 1, five(0.5)), report(NOW - 3, five(0.4))],
    want: {
      askedAt: NOW - 1,
      windows: [
        ["five_hour", 0.5],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(null, five(0.1), week(0.2)),
    name: "an ask that could not read keeps its windows, and a report is fresher than them",
    reports: [report(NOW - 4, week(0.6))],
    want: {
      askedAt: NOW - 4,
      windows: [
        ["five_hour", 0.1],
        ["seven_day", 0.6],
      ],
    },
  },
  {
    account: ask(null),
    name: "an account never asked takes its reports alone, and is known by them",
    reports: [report(NOW - 2, five(0.3)), report(NOW - 2, week(0.4))],
    want: {
      askedAt: NOW - 2,
      windows: [
        ["five_hour", 0.3],
        ["seven_day", 0.4],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0.1), week(0.2)),
    name: "the windows keep the order of the ask, a report of a window it never gave comes after",
    reports: [
      report(NOW - 1, { id: "opus", label: "Opus", resetsAt: at(10), used: 0.7 }),
      report(NOW - 1, week(0.25)),
      report(NOW - 1, five(0.15)),
    ],
    want: {
      askedAt: NOW - 1,
      windows: [
        ["five_hour", 0.15],
        ["seven_day", 0.25],
        ["opus", 0.7],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0.1), week(0.2)),
    name: "another account's report, and one of no account, change nothing",
    reports: [
      report(NOW - 1, five(0.9), "/u/.claude-c"),
      { ...report(NOW - 1, five(0.8)), account: null },
    ],
    want: {
      askedAt: NOW - 5,
      windows: [
        ["five_hour", 0.1],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0.9, at(-1)), week(0.2)),
    name: "an ask's window whose reset has passed reads as unused",
    reports: [],
    want: {
      askedAt: NOW - 5,
      windows: [
        ["five_hour", 0],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0.9, at(0)), week(0.2)),
    name: "a window resetting at this very time reads as unused",
    reports: [],
    want: {
      askedAt: NOW - 5,
      windows: [
        ["five_hour", 0],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0.1), week(0.2)),
    name: "a report's window whose reset has passed reads as unused",
    reports: [report(NOW - 1, five(0.9, at(-1)))],
    want: {
      askedAt: NOW - 1,
      windows: [
        ["five_hour", 0],
        ["seven_day", 0.2],
      ],
    },
  },
  {
    account: ask(NOW - 5, five(0, null), week(0.2)),
    name: "a window not open stays not open",
    reports: [],
    want: {
      askedAt: NOW - 5,
      windows: [
        ["five_hour", 0],
        ["seven_day", 0.2],
      ],
    },
  },
])("an account's usage: $name", ({ account, reports, want }) => {
  expect(merged(account, reports)).toEqual(want);
});

test("an expired window reads as unused with no reset, and keeps its label", () => {
  const [one] = accountUsage([ask(NOW - 5, five(0.9, at(-1)))], [], NOW);
  expect(one?.windows).toEqual([{ id: "five_hour", label: "5h", resetsAt: null, used: 0 }]);
});
