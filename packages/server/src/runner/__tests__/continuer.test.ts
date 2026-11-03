import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { SessionCache } from "../cache.ts";
import type { ContinueSettings } from "../continuer.ts";
import type { Limit } from "../events.ts";
import type { FakeAdapter } from "../fake.ts";
import { Sessions } from "../sessions.ts";
import { sessionStatus } from "../status.ts";
import { flush, limitTurn, restart, testSessions } from "./helpers.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

const ON: ContinueSettings = { afterLimit: true, afterRestart: true, beforeGate: true, cap: 3 };
const LIMIT_MESSAGE = "The usage limit has reset. Continue where you left off.";
const LIMIT_LINE = "Continued after the usage limit's reset.";
const HOUR = 60 * 60_000;

const SESSION_LIMIT: Limit = {
  kind: "session",
  resetsAt: "2026-11-03T23:40:00.000Z",
  text: "You've hit your session limit · resets 11:40pm (UTC)",
};
/** When a run stopped by `SESSION_LIMIT` continues: a minute after its reset. */
const AFTER_RESET = Date.parse("2026-11-03T23:41:00Z");

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** The clock, from `at`: `Date.now` and the fake timers move together. */
function clock(at: string) {
  let now = Date.parse(at);
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const by = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };
  return { by, to: (time: number) => by(time - now) };
}

/** Lets the session manager work until `done` holds: a process reopens through the binding. */
async function until(done: () => boolean) {
  await vi.waitFor(() => expect(done()).toBe(true), { interval: 5, timeout: 5000 });
}

/** Sends a chat message to the folder's session, refused by `limit`, and waits for its end. */
async function sendLimited(
  { adapter, repo, sessions }: { adapter: FakeAdapter; repo: string; sessions: Sessions },
  folder: string,
  limit: Limit = SESSION_LIMIT,
) {
  const session = await sessions.featureSession(repo, folder);
  limitTurn(adapter, limit);
  const { turn } = await sessions.send(repo, session.id, { text: "Go on with the plan" });
  await sessions.settled(turn);
  return { session: session.id, turn };
}

const latest = (cache: SessionCache, session: string) => cache.turns(session).at(-1)!;
const continues = (adapter: FakeAdapter) =>
  adapter.sent.filter((message) => message.text === LIMIT_MESSAGE).length;
const statusOf = (cache: SessionCache, turn: number) =>
  sessionStatus({
    blocked: false,
    latest: cache.turn(turn),
    queued: false,
    seenAt: null,
    waitsOnHuman: false,
  });

/** Review focus 5: a reset read too late continues a minute after now, never at once. */
test.each([
  { at: AFTER_RESET, name: "a minute after its reset", resetsAt: SESSION_LIMIT.resetsAt },
  { at: Date.parse("2026-11-03T15:01:00Z"), name: "an hour later without a reset" },
  {
    at: Date.parse("2026-11-03T14:02:00Z"),
    name: "a minute after now with a reset already past",
    resetsAt: "2026-11-03T13:00:00.000Z",
  },
])("US1.1 and US1.2: a session limit waits, then continues $name", async ({ at, resetsAt }) => {
  // SC-003: the end is published once the run waits, so it never reads as asking.
  const published: Array<string | undefined> = [];
  const setup = await testSessions(fixtureRepo(), {
    onChange: (change, cache) => {
      if ("turn" in change && change.state === "failed") {
        published.push(statusOf(cache, change.turn!).reason);
      }
    },
    runs: () => ON,
  });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { session, turn } = await sendLimited(setup, AGENT, { ...SESSION_LIMIT, resetsAt });

  expect(published).toEqual(["waiting"]);
  expect(cache.turn(turn)).toMatchObject({ continueAt: at, continueReason: "limit" });
  time.to(at - 1);
  await flush();
  expect(adapter.sent).toHaveLength(1);

  time.to(at);
  await until(() => adapter.sent.length === 2);
  expect(adapter.sent.at(-1)?.text).toBe(LIMIT_MESSAGE);
  const next = latest(cache, session);
  expect(cache.items(next.id, 0, 1)).toEqual([{ kind: "system", seq: 0, text: LIMIT_LINE }]);
});

test("US1.3: two runs waiting for one reset continue a minute apart", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const first = await sendLimited(setup, AGENT);
  const second = await sendLimited(setup, HUMAN);

  expect([cache.turn(first.turn)?.continueAt, cache.turn(second.turn)?.continueAt]).toEqual([
    AFTER_RESET,
    AFTER_RESET + 60_000,
  ]);
  time.to(AFTER_RESET);
  await until(() => continues(adapter) === 1);
  expect(continues(adapter)).toBe(1);
  time.to(AFTER_RESET + 60_000);
  await until(() => continues(adapter) === 2);
  expect(continues(adapter)).toBe(2);
});

/** US1, more scenarios 1, and review focus 1: the human's message takes the continue's place. */
test("a message during a wait goes at once, drops the continue, and sets the count back", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache, repo, sessions } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { session } = await sendLimited(setup, AGENT);
  // The continue is refused by the limit again: the run waits for the next reset, once continued.
  limitTurn(adapter, { ...SESSION_LIMIT, resetsAt: "2026-11-04T04:40:00.000Z" });
  time.to(AFTER_RESET);
  await until(() => cache.turns(session).length === 2 && latest(cache, session).state === "failed");
  const waiting = latest(cache, session);
  expect(cache.session(session)?.automaticContinues).toBe(1);

  adapter.script([]);
  await sessions.send(repo, session, { text: "Skip the review" });
  const sent = adapter.sent.length;
  expect(adapter.sent.at(-1)?.text).toBe("Skip the review");
  expect(cache.turn(waiting.id)).toMatchObject({ continueAt: null, continueReason: null });
  expect(cache.session(session)?.automaticContinues).toBe(0);

  time.to(Date.parse("2026-11-04T05:00:00Z"));
  await flush();
  expect(adapter.sent).toHaveLength(sent);
});

/** US1, more scenarios 2, and the edges "Stop during a wait" and "you dismissed a run". */
test.each(["Stop", "a dismiss"])("%s during a wait ends it for good", async (action) => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache, repo, sessions } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { session, turn } = await sendLimited(setup, AGENT);

  if (action === "Stop") {
    sessions.stop(repo, session);
    expect(cache.turn(turn)).toMatchObject({ continueAt: null, reason: null, state: "stopped" });
  } else {
    sessions.dismiss(repo, turn);
  }
  // A timer left armed claims nothing.
  time.to(AFTER_RESET);
  await flush();
  expect(adapter.sent).toHaveLength(1);
  // A cancel the cache does not keep would wait again at the next start.
  const next = await restart(sessions, { runs: () => ON });
  await next.startContinues();
  time.by(HOUR);
  await flush();
  expect(adapter.sent).toHaveLength(1);
});

/** US1, more scenarios 3 and 4: a wait is kept in the cache, and an overdue one goes at once. */
test.each([
  { name: "at its time", startsAt: "2026-11-03T15:00:00Z" },
  { name: "at once once overdue", startsAt: "2026-11-04T01:30:00Z" },
])("a wait survives a restart, and continues $name", async ({ startsAt }) => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  await sendLimited(setup, AGENT);

  const next = await restart(setup.sessions, { runs: () => ON });
  time.to(Date.parse(startsAt));
  await next.startContinues();
  time.by(Math.max(0, AFTER_RESET - Date.parse(startsAt)));
  await until(() => adapter.sent.length === 2);
  expect(adapter.sent.at(-1)?.text).toBe(LIMIT_MESSAGE);
});

/** Review focus 1: a second server on the same cache arms the same wait, which continues once. */
test("two servers sharing the cache continue a wait once", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { session } = await sendLimited(setup, AGENT);
  const other = new Sessions({ adapter, binding, cache, onChange: () => {}, runs: () => ON });
  await other.check();
  await other.startContinues();

  time.to(AFTER_RESET);
  await until(() => continues(adapter) > 0);
  await until(() => cache.turns(session).every((turn) => turn.state !== "queued"));
  expect(continues(adapter)).toBe(1);
});

/** US1, more scenarios 5, and the edge "a weekly or model-family limit". */
test.each([
  {
    limit: {
      kind: "other",
      resetsAt: "2026-11-09T00:00:00.000Z",
      text: "You've hit your weekly limit · resets Mon 12:00am",
    } as const,
    name: "a weekly limit",
    runs: ON,
  },
  { limit: SESSION_LIMIT, name: "the limit's continue off", runs: { ...ON, afterLimit: false } },
])("a limit that is not continued fails and asks: $name", async ({ limit, runs }) => {
  const setup = await testSessions(fixtureRepo(), { runs: () => runs });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { turn } = await sendLimited(setup, AGENT, limit);

  expect(cache.turn(turn)).toMatchObject({
    continueAt: null,
    continueReason: null,
    reason: limit.text,
    state: "failed",
  });
  time.by(7 * 24 * HOUR);
  await flush();
  expect(adapter.sent).toHaveLength(1);
});

/** SC-004, and the edge "the limit hits again right after a continue". */
test("US4.1: past the cap, the run asks: the agent keeps stopping", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const noReset: Limit = { kind: "session", text: "You've hit your session limit" };
  const { session } = await sendLimited(setup, AGENT, noReset);
  // A wait is not a continue yet.
  expect(cache.session(session)?.automaticContinues).toBe(0);

  for (const count of [1, 2, 3]) {
    limitTurn(adapter, noReset);
    time.by(HOUR);
    await until(() => latest(cache, session).state === "failed");
    expect(cache.session(session)?.automaticContinues).toBe(count);
  }
  const fourth = latest(cache, session);
  expect(cache.turns(session)).toHaveLength(4);
  expect(fourth).toMatchObject({ continueAt: null, continueReason: "limit" });
  expect(statusOf(cache, fourth.id).reason).toBe("capped");
  time.by(2 * HOUR);
  await flush();
  expect(continues(adapter)).toBe(3);
});

/** Review focus 2: a continue the agent cannot take leaves the run asking, with its own reason. */
test("US4.3: turning off the limit's continue ends its waits, and the runs ask", async () => {
  let runs = ON;
  const setup = await testSessions(fixtureRepo(), { runs: () => runs });
  const { adapter, cache, sessions } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const first = await sendLimited(setup, AGENT);
  const second = await sendLimited(setup, HUMAN);

  runs = { ...ON, afterLimit: false };
  sessions.runsChanged();
  for (const { turn } of [first, second]) {
    expect(cache.turn(turn)).toMatchObject({ continueAt: null, continueReason: null });
    expect(statusOf(cache, turn).reason).toBe("failed");
  }
  time.to(AFTER_RESET + HOUR);
  await flush();
  expect(adapter.sent).toHaveLength(2);

  runs = ON;
  const third = await sendLimited(setup, AGENT, {
    ...SESSION_LIMIT,
    resetsAt: "2026-11-04T04:40:00.000Z",
  });
  adapter.installed = false;
  await sessions.check();
  time.to(Date.parse("2026-11-04T04:41:00Z"));
  await flush();
  expect(cache.turn(third.turn)).toMatchObject({
    continueAt: null,
    continueReason: null,
    reason: SESSION_LIMIT.text,
    state: "failed",
  });
  expect(adapter.sent).toHaveLength(3);
});
