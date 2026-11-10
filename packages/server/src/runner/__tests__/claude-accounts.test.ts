import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { pickAccount } from "../account-pick.ts";
import {
  ClaudeAccounts,
  claudeAsk,
  claudeFolders,
  claudeUsageWindows,
} from "../claude-accounts.ts";

test.each([
  [
    "a folder's name drops its dot and its claude-",
    ["~/.claude-b"],
    [["/home/u/.claude-b", "b"]],
    [],
  ],
  ["~/.claude reads default", ["~/.claude"], [["/home/u/.claude", "default"]], []],
  ["a line of ~ alone is the home folder", ["~"], [["/home/u", "u"]], []],
  ["a line of ~/ is the home folder too", ["~/"], [["/home/u", "u"]], []],
  [
    "a line that starts with ~ and a name is no home folder",
    ["~b"],
    [],
    ["account folder ~b is not an absolute path"],
  ],
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
  // No five-hour window: a week never stands first, where the pick reads the five hours.
  expect(
    claudeUsageWindows(
      limits(undefined, { resets_at: "2026-11-11T12:00:00+00:00", utilization: 1 }),
    ),
  ).toBeUndefined();
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
    isFolder: () => true,
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
    isFolder: () => true,
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

const five = (used: number) => [{ id: "five_hour", label: "5h", resetsAt: null, used }];

test("an account whose usage cannot be read is picked after every account whose usage is known", async () => {
  let now = 0;
  let fail = false;
  const accounts = new ClaudeAccounts({
    ask: async (folder) => {
      if (folder.endsWith("-b")) {
        return fail ? { state: "ready" } : { state: "ready", windows: five(0) };
      }
      return { state: "ready", windows: five(0.42) };
    },
    home: "/home/u",
    isFolder: () => true,
    lines: ["~/.claude-b", "~/.claude-c"],
    now: () => now,
  });
  await accounts.refresh(60_000);
  expect(pickAccount(accounts.list())?.name).toBe("b");

  // Its next ask gives no windows: it keeps its last windows, and is no longer known.
  fail = true;
  now = 61_000;
  await accounts.refresh(60_000);
  const b = accounts.list()[0];
  expect(b?.askedAt).toBeNull();
  expect(b?.windows).toEqual(five(0));
  expect(accounts.list()[1]?.askedAt).toBe(61_000);
  expect(pickAccount(accounts.list())?.name).toBe("c");

  // The same for an ask that rejects, and it is asked again only once a minute.
  const rejecting = new ClaudeAccounts({
    ask: async (folder) => {
      if (folder.endsWith("-b") && now > 0) {
        throw new Error("no answer");
      }
      return { state: "ready", windows: five(folder.endsWith("-b") ? 0 : 0.42) };
    },
    home: "/home/u",
    isFolder: () => true,
    lines: ["~/.claude-b", "~/.claude-c"],
    now: () => now,
  });
  now = 0;
  await rejecting.refresh(60_000);
  now = 61_000;
  await rejecting.refresh(60_000);
  expect(rejecting.list()[0]?.askedAt).toBeNull();
  expect(rejecting.list()[0]?.windows).toEqual(five(0));
  expect(pickAccount(rejecting.list())?.name).toBe("c");
});

test("a folder that is no directory is missing at once, before any ask answers", async () => {
  const root = mkdtempSync(join(tmpdir(), "uraeda-accounts-"));
  try {
    const gone = join(root, ".claude-gone");
    const file = join(root, ".claude-file");
    const folder = join(root, ".claude-ok");
    writeFileSync(file, "{}");
    mkdirSync(folder);
    const asked: Array<string> = [];
    const accounts = new ClaudeAccounts({
      // An ask that never answers.
      ask: (path) => {
        asked.push(path);
        return new Promise(() => {});
      },
      lines: [gone, file, folder],
    });
    const states = () => accounts.list().map((account) => account.state);
    // As built: a path that is gone, and a regular file, are no account folder.
    expect(states()).toEqual(["missing", "missing", "ready"]);
    expect(accounts.problems()).toEqual([
      `account gone has no folder at ${gone}`,
      `account file has no folder at ${file}`,
    ]);

    // They are not asked, and a folder that appears is an account again at the next refresh.
    void accounts.refresh(0);
    expect(asked).toEqual([folder]);
    mkdirSync(gone);
    void accounts.refresh(0);
    expect(states()).toEqual(["ready", "missing", "ready"]);
    expect(asked).toEqual([folder, gone]);

    // And one that goes is missing at the next refresh, with its ask under way.
    rmSync(folder, { recursive: true });
    void accounts.refresh(0);
    expect(states()).toEqual(["ready", "missing", "missing"]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

/** A `get_usage` answer of a five-hour window, or of a signed-out folder. */
const usageAnswer = (five: number | null) =>
  five === null
    ? { rate_limits: null, rate_limits_available: false }
    : {
        rate_limits: { five_hour: { resets_at: null, utilization: five } },
        rate_limits_available: true,
      };

/**
 * A stand-in for `claude` that behaves by the name of its `CLAUDE_CONFIG_DIR`: `ok` is signed in,
 * and its `auth status` answers only once the usage process has started, so it says signed out
 * when the two run one after the other; `out` is signed out; `unsure` gives no status, and a usage
 * read; `blind` gives neither. It writes where `auth status` ran to `<dir>/cwd`.
 */
function claudeStandIn(dir: string): string {
  const agent = join(dir, "agent.cjs");
  writeFileSync(
    agent,
    `const fs = require("node:fs");
const name = require("node:path").basename(process.env.CLAUDE_CONFIG_DIR ?? "");
const marker = ${JSON.stringify(join(dir, "usage-started"))};
if (process.argv[2] === "auth") {
  fs.writeFileSync(${JSON.stringify(join(dir, "cwd"))}, process.cwd());
  const say = (status, code) => { process.stdout.write(status); process.exit(code); };
  if (name === "out") say('{"loggedIn":false}', 1);
  else if (name === "unsure" || name === "blind") say("an update is available", 1);
  else {
    const end = Date.now() + 3000;
    const tick = () => {
      if (fs.existsSync(marker)) say('{"loggedIn":true}', 0);
      else if (Date.now() > end) say('{"loggedIn":false}', 1);
      else setTimeout(tick, 20);
    };
    tick();
  }
} else {
  fs.writeFileSync(marker, "");
  const usage = ${JSON.stringify({ blind: usageAnswer(null), ok: usageAnswer(10), out: usageAnswer(null), unsure: usageAnswer(20) })}[name];
  require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
    const { request_id } = JSON.parse(line);
    process.stdout.write(JSON.stringify({ response: { request_id, response: usage, subtype: "success" }, type: "control_response" }) + "\\n");
  });
}
`,
  );
  const command = join(dir, "claude");
  writeFileSync(command, `#!/bin/sh\nexec "${process.execPath}" "${agent}" "$@"\n`, {
    mode: 0o755,
  });
  return command;
}

test("an ask runs auth status and the usage at once, from home, and combines them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uraeda-ask-"));
  try {
    const ask = claudeAsk(claudeStandIn(dir));
    const folder = (name: string) => join(dir, name);
    // Signed in: its auth status waits for the usage process, which only runs at the same time.
    expect(await ask(folder("ok"))).toEqual({
      state: "ready",
      windows: [{ id: "five_hour", label: "5h", resetsAt: null, used: 0.1 }],
    });
    // Like the other short processes, `auth status` runs from the home folder.
    expect(readFileSync(join(dir, "cwd"), "utf8")).toBe(realpathSync(homedir()));
    // Signed out wins.
    expect(await ask(folder("out"))).toEqual({ state: "signed-out" });
    // No status, but a usage read: ready with its windows.
    expect(await ask(folder("unsure"))).toEqual({
      state: "ready",
      windows: [{ id: "five_hour", label: "5h", resetsAt: null, used: 0.2 }],
    });
    // Neither says anything: the ask is rejected, and the account stays as it was.
    await expect(ask(folder("blind"))).rejects.toThrow();
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
