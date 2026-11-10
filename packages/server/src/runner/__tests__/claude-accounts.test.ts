import { expect, test } from "vite-plus/test";
import { ClaudeAccounts, claudeFolders, claudeUsageWindows } from "../claude-accounts.ts";

test.each([
  [
    "a folder's name drops its dot and its claude-",
    ["~/.claude-b"],
    [["/home/u/.claude-b", "b"]],
    [],
  ],
  ["~/.claude reads default", ["~/.claude"], [["/home/u/.claude", "default"]], []],
  [
    "a line that is no absolute path is left out",
    ["docs", "/srv/claude-work"],
    [["/srv/claude-work", "work"]],
    ["account folder docs is not an absolute path"],
  ],
  [
    "a folder listed twice is one account",
    ["~/.claude-b", "/home/u/.claude-b"],
    [["/home/u/.claude-b", "b"]],
    [],
  ],
  [
    "a second folder of the same name shows its path",
    ["~/.claude-b", "/srv/.claude-b"],
    [
      ["/home/u/.claude-b", "b"],
      ["/srv/.claude-b", "/srv/.claude-b"],
    ],
    [],
  ],
])("the listed folders become accounts: %s", (_, lines, folders, problems) => {
  const read = claudeFolders(lines, "/home/u");
  expect(read.folders.map(({ id, name }) => [id, name])).toEqual(folders);
  expect(read.problems).toEqual(problems);
});

/** A `get_usage` answer of the two windows. */
const limits = (five: unknown, week: unknown) => ({
  rate_limits: { five_hour: five, seven_day: week },
  rate_limits_available: true,
});

test("Claude Code's usage answer gives the windows", () => {
  expect(
    claudeUsageWindows(
      limits(
        { resets_at: "2026-11-10T06:19:59.947714+00:00", utilization: 76 },
        { resets_at: "2026-11-15T22:59:59.947732+00:00", utilization: 38 },
      ),
    ),
  ).toEqual([
    { id: "five_hour", label: "5h", resetsAt: "2026-11-10T06:19:59.947Z", used: 0.76 },
    { id: "seven_day", label: "Week", resetsAt: "2026-11-15T22:59:59.947Z", used: 0.38 },
  ]);
  // An unused account, as Claude Code 2.1.322 answered for one: no reset.
  expect(
    claudeUsageWindows(
      limits(
        { resets_at: null, utilization: 0 },
        { resets_at: "2026-11-11T12:00:00+00:00", utilization: 0 },
      ),
    )?.[0],
  ).toEqual({ id: "five_hour", label: "5h", resetsAt: null, used: 0 });
  // A signed-out folder.
  expect(claudeUsageWindows({ rate_limits: null, rate_limits_available: false })).toBeUndefined();
});

test("each account is asked at most once a minute, and once at a time", async () => {
  let now = 0;
  const asked: Array<string> = [];
  const accounts = new ClaudeAccounts({
    ask: async (folder) => {
      asked.push(folder);
      return folder.endsWith("-b") ? { state: "signed-out" } : { state: "ready", windows: [] };
    },
    home: "/home/u",
    lines: ["~/.claude", "~/.claude-b"],
    now: () => now,
  });
  await Promise.all([accounts.refresh(60_000), accounts.refresh(60_000)]);
  expect(asked).toHaveLength(2);
  expect(accounts.problems()).toEqual(["account b is signed out, in ~/.claude-b"]);
  now = 59_000;
  await accounts.refresh(60_000);
  expect(asked).toHaveLength(2);
  now = 61_000;
  await accounts.refresh(60_000);
  expect(asked).toHaveLength(4);
});

test("review focus 2: a caller that comes while an ask is under way waits for that ask", async () => {
  const { promise: gate, resolve: release } = Promise.withResolvers<void>();
  const asked: Array<string> = [];
  const accounts = new ClaudeAccounts({
    ask: async (folder) => {
      asked.push(folder);
      await gate;
      return {
        state: "ready",
        windows: [{ id: "five_hour", label: "5h", resetsAt: null, used: 0.5 }],
      };
    },
    home: "/home/u",
    lines: ["~/.claude-b"],
    now: () => 0,
  });
  const first = accounts.refresh(0);
  let second = false;
  const waiting = accounts.refresh(0).then(() => (second = true));
  await Promise.resolve();
  expect(second).toBe(false);
  release();
  await Promise.all([first, waiting]);
  expect(asked).toHaveLength(1);
  expect(accounts.list()[0]?.windows[0]?.used).toBe(0.5);
});
