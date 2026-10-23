import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { parseLine } from "../claude-events.ts";
import type { AgentEvent } from "../events.ts";
import { IDLE_CLOSE_MS } from "../sessions.ts";
import { flush, testSessions } from "./helpers.ts";

afterEach(() => vi.useRealTimers());

const report = (
  percentUsed: number,
  resetsAt = new Date(Date.now() + 3_600_000).toISOString(),
): AgentEvent => ({
  fiveHour: { percentUsed, resetsAt },
  type: "usage",
});

/** A report of the week alone, or of both windows. */
const weekReport = (
  percentUsed: number,
  fiveHour?: number,
  resetsAt = new Date(Date.now() + 86_400_000).toISOString(),
): AgentEvent => ({
  ...(fiveHour === undefined
    ? {}
    : {
        fiveHour: {
          percentUsed: fiveHour,
          resetsAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      }),
  type: "usage",
  week: { percentUsed, resetsAt },
});

const parseInfo = (info: unknown) =>
  parseLine(JSON.stringify({ rate_limit_info: info, type: "rate_limit_event" }));

test("five-hour reports normalize the unified window or a direct window", () => {
  const fiveHour = { resetsAt: 1_791_798_000, utilization: 0.437 };
  for (const info of [
    { unifiedWindows: { five_hour: fiveHour, seven_day: { utilization: 0.9 } } },
    { ...fiveHour, rateLimitType: "five_hour" },
  ]) {
    expect(parseLine(JSON.stringify({ rate_limit_info: info, type: "rate_limit_event" }))).toEqual([
      report(43.7, new Date(fiveHour.resetsAt * 1000).toISOString()),
    ]);
  }
});

test("a report with the five-hour and the seven-day windows gives both, each from its own window", () => {
  const fiveHour = { resetsAt: 1_791_798_000, utilization: 0.437 };
  const sevenDay = { resetsAt: 1_792_300_000, utilization: 0.12 };
  expect(parseInfo({ unifiedWindows: { five_hour: fiveHour, seven_day: sevenDay } })).toEqual([
    {
      fiveHour: { percentUsed: 43.7, resetsAt: new Date(fiveHour.resetsAt * 1000).toISOString() },
      type: "usage",
      week: { percentUsed: 12, resetsAt: new Date(sevenDay.resetsAt * 1000).toISOString() },
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
        week: { percentUsed: 43, resetsAt: new Date(sevenDay.resetsAt * 1000).toISOString() },
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
    report(43, new Date(fiveHour.resetsAt * 1000).toISOString()),
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
  expect(sessions.status().fiveHourLimit).toBeNull();
  const first = await sessions.newChat(repo);
  adapter.script([report(60)]);
  await sessions.settled((await sessions.send(repo, first.id, { text: "First" })).turn);
  expect(sessions.status().fiveHourLimit?.percentUsed).toBe(60);
  // A more recent report can be lower, so choosing the maximum would be wrong.
  adapter.emit(report(30));
  await flush();
  expect(sessions.status().fiveHourLimit?.percentUsed).toBe(30);

  const second = await sessions.newChat(fixtureRepo());
  adapter.script([report(70)]);
  await sessions.settled((await sessions.send(second.repo, second.id, { text: "Second" })).turn);
  expect(sessions.status().fiveHourLimit?.percentUsed).toBe(70);
  const before = changes.length;
  adapter.exit();
  await flush();
  expect(sessions.status().fiveHourLimit?.percentUsed).toBe(30);
  expect(changes.slice(before)).toContainEqual({ agent: true });
  expect(cache.itemsOf(cache.turns(first.id)[0]!.id, "system")).toEqual([]);

  await vi.advanceTimersByTimeAsync(IDLE_CLOSE_MS);
  expect(sessions.status().fiveHourLimit).toBeNull();
});

test("a report expires without another runner event, and publishes the cleared allowance", async () => {
  const { adapter, changes, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const chat = await sessions.newChat(repo);
  adapter.script([report(100, new Date(Date.now() + 60_000).toISOString())]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(sessions.status().fiveHourLimit?.percentUsed).toBe(100);
  const before = changes.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(sessions.status().fiveHourLimit).toBeNull();
  expect(changes.slice(before)).toContainEqual({ agent: true });
  adapter.emit(report(40, new Date(Date.now() - 1000).toISOString()));
  await flush();
  expect(sessions.status().fiveHourLimit).toBeNull();
});

test("each window keeps the newest live report of its own, and a report without the week keeps it", async () => {
  const { adapter, repo, sessions } = await testSessions();
  expect(sessions.status().weekLimit).toBeNull();
  const chat = await sessions.newChat(repo);
  adapter.script([weekReport(20, 60)]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "First" })).turn);
  expect(sessions.status()).toMatchObject({
    fiveHourLimit: { percentUsed: 60 },
    weekLimit: { percentUsed: 20 },
  });
  // A report of the five-hour window alone says nothing of the week.
  adapter.emit(report(70));
  await flush();
  expect(sessions.status()).toMatchObject({
    fiveHourLimit: { percentUsed: 70 },
    weekLimit: { percentUsed: 20 },
  });
  adapter.emit(weekReport(25));
  await flush();
  expect(sessions.status()).toMatchObject({
    fiveHourLimit: { percentUsed: 70 },
    weekLimit: { percentUsed: 25 },
  });
  adapter.exit();
  await flush();
  expect(sessions.status()).toMatchObject({ fiveHourLimit: null, weekLimit: null });
});

test("the week expires on its own reset, apart from the five-hour window", async () => {
  const { adapter, changes, repo, sessions } = await testSessions();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const chat = await sessions.newChat(repo);
  adapter.script([
    report(50, new Date(Date.now() + 120_000).toISOString()),
    weekReport(30, undefined, new Date(Date.now() + 60_000).toISOString()),
  ]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(sessions.status().weekLimit?.percentUsed).toBe(30);
  const before = changes.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(sessions.status()).toMatchObject({ fiveHourLimit: { percentUsed: 50 }, weekLimit: null });
  expect(changes.slice(before)).toContainEqual({ agent: true });
});
