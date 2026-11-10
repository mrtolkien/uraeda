import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { parseLine } from "../claude-events.ts";
import type { AgentEvent } from "../events.ts";
import { IDLE_CLOSE_MS, type Sessions } from "../sessions.ts";
import { account, at, fakeAccounts, flush, folder, testSessions } from "./helpers.ts";

afterEach(() => vi.useRealTimers());

/** Claude's five-hour window, `used` of it, as a report gives it. */
const fiveHourWindow = (used: number, resetsAt: string) => ({
  id: "five_hour",
  label: "5h",
  resetsAt,
  used,
});

/** Claude's week, `used` of it, as a report gives it. */
const weekWindow = (used: number, resetsAt: string) => ({
  id: "seven_day",
  label: "Week",
  resetsAt,
  used,
});

const report = (
  used: number,
  resetsAt = new Date(Date.now() + 3_600_000).toISOString(),
): AgentEvent => ({ type: "usage", windows: [fiveHourWindow(used, resetsAt)] });

/** A report of the week alone, or of both windows. */
const weekReport = (
  used: number,
  fiveHour?: number,
  resetsAt = new Date(Date.now() + 86_400_000).toISOString(),
): AgentEvent => ({
  type: "usage",
  windows: [
    ...(fiveHour === undefined
      ? []
      : [fiveHourWindow(fiveHour, new Date(Date.now() + 3_600_000).toISOString())]),
    weekWindow(used, resetsAt),
  ],
});

/** The share used of each window of the fake runtime, by the window's ID. */
const used = (sessions: Sessions) =>
  Object.fromEntries(sessions.usage("fake").map((window) => [window.id, window.used]));

const parseInfo = (info: unknown) =>
  parseLine(JSON.stringify({ rate_limit_info: info, type: "rate_limit_event" }));

test("five-hour reports normalize the unified window or a direct window", () => {
  const fiveHour = { resetsAt: 1_791_798_000, utilization: 0.437 };
  for (const info of [
    { unifiedWindows: { five_hour: fiveHour, seven_day: { utilization: 0.9 } } },
    { ...fiveHour, rateLimitType: "five_hour" },
  ]) {
    expect(parseLine(JSON.stringify({ rate_limit_info: info, type: "rate_limit_event" }))).toEqual([
      report(0.437, new Date(fiveHour.resetsAt * 1000).toISOString()),
    ]);
  }
});

test("a report with the five-hour and the seven-day windows gives both, each from its own window", () => {
  const fiveHour = { resetsAt: 1_791_798_000, utilization: 0.437 };
  const sevenDay = { resetsAt: 1_792_300_000, utilization: 0.12 };
  expect(parseInfo({ unifiedWindows: { five_hour: fiveHour, seven_day: sevenDay } })).toEqual([
    {
      type: "usage",
      windows: [
        fiveHourWindow(0.437, new Date(fiveHour.resetsAt * 1000).toISOString()),
        weekWindow(0.12, new Date(sevenDay.resetsAt * 1000).toISOString()),
      ],
    },
  ]);
});

test("a seven-day report alone gives the week, from the unified window or a direct window", () => {
  const sevenDay = { resetsAt: 1_792_300_000, utilization: 0.43 };
  for (const info of [
    { unifiedWindows: { seven_day: sevenDay } },
    { ...sevenDay, rateLimitType: "seven_day" },
  ]) {
    expect(parseInfo(info)).toEqual([
      {
        type: "usage",
        windows: [weekWindow(0.43, new Date(sevenDay.resetsAt * 1000).toISOString())],
      },
    ]);
  }
});

test.each([
  { utilization: 0.9 },
  { resetsAt: 1_792_300_000, utilization: -1 },
  { resetsAt: 1e30, utilization: 0.43 },
  { resetsAt: "next week", utilization: 0.43 },
])("a malformed seven-day window gives no week and keeps the five-hour one: %j", (sevenDay) => {
  const fiveHour = { resetsAt: 1_791_798_000, utilization: 0.43 };
  expect(parseInfo({ unifiedWindows: { five_hour: fiveHour, seven_day: sevenDay } })).toEqual([
    report(0.43, new Date(fiveHour.resetsAt * 1000).toISOString()),
  ]);
  expect(parseInfo({ unifiedWindows: { seven_day: sevenDay } })).toEqual([]);
});

test.each([
  null,
  {},
  { rateLimitType: "five_hour", status: "allowed" },
  { rateLimitType: "seven_day", status: "allowed" },
  { unifiedWindows: { five_hour: { resetsAt: 1_791_798_000 } } },
  { unifiedWindows: { five_hour: { resetsAt: 1_791_798_000, utilization: -1 } } },
  { unifiedWindows: { five_hour: { resetsAt: 1e30, utilization: 0.43 } } },
  { unifiedWindows: { five_hour: { resetsAt: "tomorrow", utilization: 0.43 } } },
])("missing or malformed usage gives no report: %j", (info) => {
  expect(parseLine(JSON.stringify({ rate_limit_info: info, type: "rate_limit_event" }))).toEqual(
    [],
  );
});

test("the newest live report wins across repositories and falls back when its process exits", async () => {
  const { adapter, cache, changes, repo, sessions } = await testSessions();
  expect(used(sessions).five_hour).toBeUndefined();
  const first = await sessions.newChat(repo);
  adapter.script([report(0.6)]);
  await sessions.settled((await sessions.send(repo, first.id, { text: "First" })).turn);
  expect(used(sessions).five_hour).toBe(0.6);
  // A more recent report can be lower, so choosing the maximum would be wrong.
  adapter.emit(report(0.3));
  await flush();
  expect(used(sessions).five_hour).toBe(0.3);

  const second = await sessions.newChat(fixtureRepo());
  adapter.script([report(0.7)]);
  await sessions.settled((await sessions.send(second.repo, second.id, { text: "Second" })).turn);
  expect(used(sessions).five_hour).toBe(0.7);
  const before = changes.length;
  adapter.exit();
  await flush();
  expect(used(sessions).five_hour).toBe(0.3);
  expect(changes.slice(before)).toContainEqual({ agent: true });
  expect(cache.itemsOf(cache.turns(first.id)[0]!.id, "system")).toEqual([]);

  await vi.advanceTimersByTimeAsync(IDLE_CLOSE_MS);
  expect(used(sessions).five_hour).toBeUndefined();
});

test("a report expires without another runner event, and publishes the cleared allowance", async () => {
  const { adapter, changes, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const chat = await sessions.newChat(repo);
  adapter.script([report(1, new Date(Date.now() + 60_000).toISOString())]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(used(sessions).five_hour).toBe(1);
  const before = changes.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(used(sessions).five_hour).toBeUndefined();
  expect(changes.slice(before)).toContainEqual({ agent: true });
  adapter.emit(report(0.4, new Date(Date.now() - 1000).toISOString()));
  await flush();
  expect(used(sessions).five_hour).toBeUndefined();
});

test("each window keeps the newest live report of its own, and a report without the week keeps it", async () => {
  const { adapter, repo, sessions } = await testSessions();
  expect(used(sessions).seven_day).toBeUndefined();
  const chat = await sessions.newChat(repo);
  adapter.script([weekReport(0.2, 0.6)]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "First" })).turn);
  expect(used(sessions)).toEqual({ five_hour: 0.6, seven_day: 0.2 });
  // A report of the five-hour window alone says nothing of the week.
  adapter.emit(report(0.7));
  await flush();
  expect(used(sessions)).toEqual({ five_hour: 0.7, seven_day: 0.2 });
  adapter.emit(weekReport(0.25));
  await flush();
  expect(used(sessions)).toEqual({ five_hour: 0.7, seven_day: 0.25 });
  adapter.exit();
  await flush();
  expect(used(sessions)).toEqual({});
});

test("the week expires on its own reset, apart from the five-hour window", async () => {
  const { adapter, changes, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const chat = await sessions.newChat(repo);
  adapter.script([
    report(0.5, new Date(Date.now() + 120_000).toISOString()),
    weekReport(0.3, undefined, new Date(Date.now() + 60_000).toISOString()),
  ]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(used(sessions).seven_day).toBe(0.3);
  const before = changes.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(used(sessions)).toEqual({ five_hour: 0.5 });
  expect(changes.slice(before)).toContainEqual({ agent: true });
});

/** One account's record by its name, as the records the UI reads give it. */
const accountOf = (sessions: Sessions, name: string) =>
  sessions.accounts("fake").find((each) => each.name === name);

test("an account's usage is the freshest of its ask and its processes' reports", async () => {
  const { adapter, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts(); // default 0.42, b 0, c 0.88: asked at the start
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "First" })).turn); // picks b
  expect(adapter.opens.at(-1)?.account).toBe(folder("b"));

  // Its process reports 0.3 of b's five hours, after the ask: the report is the freshest.
  await vi.advanceTimersByTimeAsync(1000);
  adapter.emit(report(0.3, at(1)));
  await flush();
  expect(accountOf(sessions, "b")?.windows.map((window) => window.used)).toEqual([0.3, 0.3]);
  expect(sessions.usage("fake")).toEqual([]); // the process has an account: not the runtime's
  const [record] = sessions.runtimes.records(null, {
    accounts: (name) => sessions.accounts(name),
    usage: (name) => sessions.usage(name),
  });
  expect(record?.usage).toEqual([]);
  expect(record?.accounts.map(({ name }) => name)).toEqual(["default", "b", "c"]);
  expect(
    sessions
      .accounts("fake")
      .filter(({ isNext }) => isNext)
      .map(({ name }) => name),
  ).toEqual(["b"]);

  // Its exit keeps the report: it is the freshest read of b until a newer ask answers, and the next
  // session must not start on what the turn just burned.
  adapter.exit();
  await flush();
  expect(accountOf(sessions, "b")?.windows.map((window) => window.used)).toEqual([0.3, 0.3]);

  // The same process, reopened, reports again: and an ask after the report replaces it.
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "More" })).turn);
  await vi.advanceTimersByTimeAsync(1000);
  adapter.emit(report(0.3, at(1)));
  await flush();
  expect(accountOf(sessions, "b")?.windows[0]?.used).toBe(0.3);
  // After a use in a terminal, b's ask says 0.5, a minute later.
  await vi.advanceTimersByTimeAsync(61_000);
  adapter.accounts.accounts = adapter.accounts.accounts.map((each) =>
    each.name === "b" ? account("b", 0.5) : each,
  );
  sessions.refreshAccounts();
  await flush();
  expect(accountOf(sessions, "b")?.windows[0]?.used).toBe(0.5);
  // b is no longer the next: default has the most of its five hours left.
  expect(
    sessions
      .accounts("fake")
      .filter(({ isNext }) => isNext)
      .map(({ name }) => name),
  ).toEqual(["default"]);
});

test("a window whose reset has passed reads as unused, in the panes and in the pick", async () => {
  const { adapter, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  adapter.accounts.accounts = [
    account("default", 0.42),
    {
      ...account("b", 0.95),
      windows: [
        { id: "five_hour", label: "5h", resetsAt: at(1), used: 0.95 },
        { id: "seven_day", label: "Week", resetsAt: at(72), used: 0.3 },
      ],
    },
  ];
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("default");
  await vi.advanceTimersByTimeAsync(1.5 * 3_600_000);
  // b's five hours reset half an hour ago: its pane shows them unused, and the pick takes b.
  expect(accountOf(sessions, "b")?.windows[0]).toEqual({
    id: "five_hour",
    label: "5h",
    resetsAt: null,
    used: 0,
  });
  expect(accountOf(sessions, "b")?.windows[1]?.used).toBe(0.3);
  expect(accountOf(sessions, "default")?.windows[0]?.used).toBe(0.42);
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(adapter.opens.at(-1)?.account).toBe(folder("b"));
});

test("a pick counts a running process's report, as it counts an ask", async () => {
  const { adapter, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  const first = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, first.id, { text: "First" })).turn); // b
  // Its process says b's five hours are used up since the ask: the next session starts elsewhere.
  await vi.advanceTimersByTimeAsync(1000);
  adapter.emit(report(1, at(1)));
  await flush();
  const second = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, second.id, { text: "Second" })).turn);
  expect(adapter.opens.at(-1)?.account).toBe(folder("default"));
});

test("a refresh that asked nothing announces nothing", async () => {
  const { adapter, changes, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  const announced = () => changes.filter((change) => "agent" in change).length;
  const before = announced();

  // The first read asks, and the answer changes no record: nothing is announced.
  sessions.refreshAccounts();
  await flush();
  expect(adapter.accounts.asks).toBe(1);
  // Reads within the minute, as a page does on each announce, ask nothing.
  for (let read = 0; read < 3; read++) {
    sessions.refreshAccounts();
    await flush();
  }
  expect(adapter.accounts.asks).toBe(1);
  expect(announced()).toBe(before);

  // An answer that changes an account's usage is announced once, though pages read meanwhile.
  const accounts = adapter.accounts!;
  vi.spyOn(accounts, "refresh").mockImplementation(async () => {
    accounts.accounts = [account("default", 0.9), account("b", 0), account("c", 0.88)];
    await flush();
  });
  sessions.refreshAccounts();
  sessions.refreshAccounts();
  await flush();
  await flush();
  expect(announced()).toBe(before + 1);
});

test("a closed process's report stays until a newer ask, and the pick reads it", async () => {
  const { adapter, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts(); // b at 0, asked
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "First" })).turn); // b
  // The ask read b at 0; its turn reports 0.9 and ends, within the minute that nothing is asked.
  await vi.advanceTimersByTimeAsync(1000);
  adapter.emit(report(0.9, at(1)));
  adapter.exit();
  await flush();
  expect(accountOf(sessions, "b")?.windows[0]?.used).toBe(0.9);
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("default");
  const second = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, second.id, { text: "Second" })).turn);
  expect(adapter.opens.at(-1)?.account).toBe(folder("default"));
});

test("an expired report of an account still counts as read, as unused", async () => {
  const { adapter, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  adapter.accounts.accounts = [account("default", 0.1), account("b", 0.5), account("c", 0.4)];
  vi.spyOn(adapter.accounts, "refresh").mockResolvedValue(); // the asks answer nothing
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "First" })).turn);
  expect(adapter.opens.at(-1)?.account).toBe(folder("default"));
  // Its next ask could not read it: default is unknown, and c is the next.
  adapter.accounts.accounts = adapter.accounts.accounts.map((one) =>
    one.name === "default" ? { ...one, known: false } : one,
  );
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("c");
  // Its process reports default's five hours, nearly full, resetting in an hour: known again.
  await vi.advanceTimersByTimeAsync(1000);
  adapter.emit(report(0.9, at(1)));
  await flush();
  expect(accountOf(sessions, "default")?.windows[0]?.used).toBe(0.9);
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("c");
  // The reset passes with no event: it reads unused, not unknown, so default is the next again.
  await vi.advanceTimersByTimeAsync(1.5 * 3_600_000);
  expect(accountOf(sessions, "default")?.windows[0]).toEqual({
    id: "five_hour",
    label: "5h",
    resetsAt: null,
    used: 0,
  });
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("default");
});

const window = (id: string, used: number, resets: number) => ({
  id,
  label: id === "five_hour" ? "5h" : "Week",
  resetsAt: at(resets),
  used,
});

test("an asked window's reset is announced when it comes, with no process and no read", async () => {
  const { adapter, changes, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  adapter.accounts = fakeAccounts();
  adapter.accounts.accounts = [
    {
      ...account("default", 1),
      windows: [window("five_hour", 1, 1), window("seven_day", 0.3, 72)],
    },
    { ...account("b", 0.9), windows: [window("five_hour", 0.9, 3), window("seven_day", 0.3, 72)] },
  ];
  const announced = () => changes.filter((change) => "agent" in change).length;
  sessions.refreshAccounts();
  await flush();
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("b");
  const before = announced();

  // default's five hours reset in an hour: the records change then, and say so.
  await vi.advanceTimersByTimeAsync(3_600_000 + 1);
  expect(announced()).toBeGreaterThan(before);
  expect(accountOf(sessions, "default")?.windows[0]?.used).toBe(0);
  expect(sessions.accounts("fake").find(({ isNext }) => isNext)?.name).toBe("default");
  // The next reset, b's, is armed in its turn.
  const after = announced();
  await vi.advanceTimersByTimeAsync(2 * 3_600_000);
  expect(announced()).toBeGreaterThan(after);
  expect(accountOf(sessions, "b")?.windows[0]?.used).toBe(0);
});
