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

test.each([
  null,
  {},
  { rateLimitType: "five_hour", status: "allowed" },
  { rateLimitType: "seven_day", resetsAt: 1_791_798_000, utilization: 0.43 },
  { unifiedWindows: { five_hour: { resetsAt: 1_791_798_000 } } },
  { unifiedWindows: { five_hour: { resetsAt: 1_791_798_000, utilization: -1 } } },
  { unifiedWindows: { five_hour: { resetsAt: 1e30, utilization: 0.43 } } },
  { unifiedWindows: { five_hour: { resetsAt: "tomorrow", utilization: 0.43 } } },
])("missing, weekly or malformed usage gives no report: %j", (info) => {
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
