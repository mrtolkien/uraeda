import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { parseLine } from "../claude-events.ts";
import type { AgentEvent } from "../events.ts";
import { IDLE_CLOSE_MS, type Sessions } from "../sessions.ts";
import { flush, testSessions } from "./helpers.ts";

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
