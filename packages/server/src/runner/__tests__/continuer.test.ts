import { afterEach, expect, test, vi } from "vite-plus/test";
import { commitOnBranch, fixtureRepo } from "uraeda-binding/test-utils";
import type { Binding } from "../../fate/context.ts";
import type { SessionCache } from "../cache.ts";
import type { ContinueSettings } from "../continuer.ts";
import type { Denial, Limit } from "../events.ts";
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
const RESTART_MESSAGE = "The server restarted while you worked. Continue where you left off.";
const RESTART_LINE = "Continued after the server restarted.";
const GATE_MESSAGE = "You stopped before the next human gate. Continue to it.";
const GATE_LINE =
  "The run stopped before a human gate. Uraeda asked it to continue to the next one.";
/** The workflow's message at the agent's step, in the session it is sent to. */
const PLAN = { fresh: false, step: "plan", trigger: "manual" } as const;

const SESSION_LIMIT: Limit = {
  kind: "session",
  resetsAt: "2026-11-03T23:40:00.000Z",
  text: "You've hit your session limit · resets 11:40pm (UTC)",
};
/** An action blocked: a run that stops on one asks the human, and never goes on by itself. */
const PUSH: Denial = { input: { command: "git push origin HEAD" }, tool: "Bash" };
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
  denials: Array<Denial> = [],
) {
  const session = await sessions.featureSession(repo, folder);
  limitTurn(adapter, limit, denials);
  const { turn } = await sessions.send(repo, session.id, { text: "Go on with the plan" });
  await sessions.settled(turn);
  return { session: session.id, turn };
}

const latest = (cache: SessionCache, session: string) => cache.turns(session).at(-1)!;
const continues = (adapter: FakeAdapter) =>
  adapter.sent.filter((message) => message.text === LIMIT_MESSAGE).length;
/** The turn's status, as its session's latest, its feature at `plan`, waiting on the agent. */
const statusOf = (cache: SessionCache, turn: number, wakeup = false) =>
  sessionStatus({
    blocked: false,
    latest: cache.turn(turn),
    queued: false,
    seenAt: null,
    stepName: "plan",
    waitsOnAgent: true,
    waitsOnHuman: false,
    wakeup,
  });
const sentOf = (adapter: FakeAdapter, text: string) =>
  adapter.sent.filter((message) => message.text === text).length;
/** A step that holds its turn until the process ends: a run the restart cuts. */
const hold = () => new Promise<void>(() => {});

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

/** SC-003: a limit's turn whose process exits is never published asking, by any change. */
test("a limit whose process exits publishes its run only waiting", async () => {
  const published: Array<string | undefined> = [];
  const setup = await testSessions(fixtureRepo(), {
    onChange: (change, cache) => {
      const turn = "session" in change ? cache.turns(change.session).at(-1) : undefined;
      if (turn?.state === "failed") {
        published.push(statusOf(cache, turn.id).reason);
      }
    },
    runs: () => ON,
  });
  const { adapter, cache, repo, sessions } = setup;
  clock("2026-11-03T14:01:00Z");
  const session = await sessions.featureSession(repo, AGENT);
  // The process exits after the limit's event, without a result.
  adapter.script([
    { limit: SESSION_LIMIT, type: "limit" },
    { code: 1, stderr: SESSION_LIMIT.text!, type: "exit" },
  ]);
  const { turn } = await sessions.send(repo, session.id, { text: "Go on with the plan" });
  await sessions.settled(turn);
  await flush();
  expect(cache.turn(turn)).toMatchObject({ continueAt: AFTER_RESET, state: "failed" });
  expect(published.length).toBeGreaterThan(0);
  expect(new Set(published)).toEqual(new Set(["waiting"]));
});

test.each([
  {
    at: [AFTER_RESET, AFTER_RESET + 60_000],
    first: SESSION_LIMIT,
    name: "two runs waiting for one reset continue a minute apart",
    second: SESSION_LIMIT,
  },
  {
    at: [Date.parse("2026-11-03T15:01:00Z"), Date.parse("2026-11-03T14:06:00Z")],
    first: { kind: "session", text: "You've hit your session limit" } as const,
    name: "a run waiting an hour without a reset does not delay a reset 4 minutes away",
    second: { ...SESSION_LIMIT, resetsAt: "2026-11-03T14:05:00.000Z" },
  },
])("US1.3: $name", async ({ at, first: firstLimit, second: secondLimit }) => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const first = await sendLimited(setup, AGENT, firstLimit);
  const second = await sendLimited(setup, HUMAN, secondLimit);

  expect([cache.turn(first.turn)?.continueAt, cache.turn(second.turn)?.continueAt]).toEqual(at);
  for (const [index, when] of [...at].sort((a, b) => a - b).entries()) {
    time.to(when);
    await until(() => continues(adapter) === index + 1);
    expect(continues(adapter)).toBe(index + 1);
  }
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

/** A message the server refuses never went: the wait it cancelled comes back, with its count. */
test("a message refused during a wait leaves the wait in place", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache, changes, repo, sessions } = setup;
  clock("2026-11-03T14:01:00Z");
  // An older session of the feature works while its latest waits.
  const older = await sessions.featureSession(repo, AGENT);
  await sessions.newSession(repo, AGENT);
  const { session, turn } = await sendLimited(setup, AGENT);
  cache.addContinue(session);
  adapter.script([hold]);
  await sessions.send(repo, older.id, { text: "Look at the tests" });

  const published = changes.length;
  await expect(sessions.send(repo, session, { text: "Skip the review" })).rejects.toThrow(
    /refused: /,
  );
  expect(cache.turn(turn)).toMatchObject({ continueAt: AFTER_RESET, continueReason: "limit" });
  expect(cache.session(session)?.automaticContinues).toBe(1);
  // A view holding the turn read its wait gone, then back.
  expect(changes.slice(published)).toContainEqual(expect.objectContaining({ turn }));
});

/** Rule 6: a continue's turn taken back before it started gives the run back its own reason. */
test("a continue taken back while queued leaves the run failed, not capped", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache, repo, sessions } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  // An older session of the feature works: the continue's turn waits behind it.
  const older = await sessions.featureSession(repo, AGENT);
  await sessions.newSession(repo, AGENT);
  const { session, turn } = await sendLimited(setup, AGENT);
  adapter.script([hold]);
  await sessions.send(repo, older.id, { text: "Look at the tests" });

  time.to(AFTER_RESET);
  await until(() => latest(cache, session).state === "queued");
  const queued = latest(cache, session);
  const [message] = cache.itemsOf(queued.id, "message");
  sessions.takeBack(repo, session, message!.id);
  await flush();

  expect(cache.turn(queued.id)).toMatchObject({ state: "stopped" });
  expect(cache.turn(turn)).toMatchObject({ continueReason: null, state: "failed" });
  expect(statusOf(cache, turn).reason).toBe("failed");
});

/** Review focus 1: Allow, a new session, or the agent going on takes the run over from its wait. */
test.each(["Allow", "a new session", "the agent going on by itself"])(
  "%s during a wait drops the continue at the reset",
  async (action) => {
    const setup = await testSessions(fixtureRepo(), { runs: () => ON });
    const { adapter, cache, repo, sessions } = setup;
    const time = clock("2026-11-03T14:01:00Z");
    const session = await sessions.featureSession(repo, AGENT);
    // A blocked push the human has not allowed yet, before the run met the limit.
    adapter.script([{ denials: [PUSH], errors: [], interrupted: false, ok: true, type: "result" }]);
    const blocked = await sessions.send(repo, session.id, { text: "Push it" });
    await sessions.settled(blocked.turn);
    const { turn } = await sendLimited(setup, AGENT);
    // The run continued once before this wait.
    cache.addContinue(session.id);

    if (action === "Allow") {
      adapter.script([]);
      const [denial] = cache.itemsOf(blocked.turn, "denial");
      await sessions.settled(
        (await sessions.allow(repo, session.id, blocked.turn, denial!.seq)).turn,
      );
      expect(cache.turn(turn)).toMatchObject({ continueAt: null, continueReason: null });
      expect(cache.session(session.id)?.automaticContinues).toBe(0);
    } else if (action === "a new session") {
      await sessions.newSession(repo, AGENT);
    } else {
      adapter.emit({ text: "The background task finished.", type: "text" });
      await until(() => cache.turn(turn)?.state === "running");
      adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
      await sessions.settled(turn);
    }
    const turns = cache.turns(session.id).length;
    time.to(AFTER_RESET);
    await flush();
    expect(cache.turns(session.id)).toHaveLength(turns);
    expect(continues(adapter)).toBe(0);
    expect(cache.turn(turn)).toMatchObject({ continueAt: null, continueReason: null });
  },
);

/** A Stop, or the switch turned off, while the decision reads the feature's commit wins. */
test.each(["Stop", "the limit's continue turned off"])(
  "%s while the continue is decided drops it",
  async (action) => {
    let release!: () => void;
    const reading = new Promise<void>((resolve) => (release = resolve));
    const held: Binding = {
      ...binding,
      checkoutCommit: async (dir) => {
        await reading;
        return binding.checkoutCommit(dir);
      },
    };
    let runs = ON;
    const setup = await testSessions(fixtureRepo(), { binding: held, runs: () => runs });
    const { adapter, cache, repo, sessions } = setup;
    const time = clock("2026-11-03T14:01:00Z");
    const session = await sessions.featureSession(repo, AGENT);
    limitTurn(adapter, SESSION_LIMIT);
    const { turn } = await sessions.send(repo, session.id, { text: "Go on with the plan" });
    await until(() => cache.turn(turn)?.state === "failed");

    if (action === "Stop") {
      sessions.stop(repo, session.id);
    } else {
      runs = { ...ON, afterLimit: false };
      sessions.runsChanged();
    }
    release();
    await sessions.settled(turn);
    expect(cache.turn(turn)).toMatchObject({ continueAt: null, continueReason: null });
    time.to(AFTER_RESET + HOUR);
    await flush();
    expect(adapter.sent).toHaveLength(1);
  },
);

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

/**
 * US1, more scenarios 3 and 4: a wait is kept in the cache, and an overdue one goes at once; the
 * overdue waits of several runs go a minute apart, in their order.
 */
test.each([
  { name: "at its time", runs: 1, startsAt: "2026-11-03T15:00:00Z" },
  { name: "at once once overdue", runs: 1, startsAt: "2026-11-04T01:30:00Z" },
  { name: "a minute apart, two runs overdue", runs: 2, startsAt: "2026-11-04T01:30:00Z" },
])("a wait survives a restart, and continues $name", async ({ runs, startsAt }) => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const first = await sendLimited(setup, AGENT);
  const second = runs === 2 ? await sendLimited(setup, HUMAN) : undefined;

  const next = await restart(setup.sessions, { runs: () => ON });
  time.to(Date.parse(startsAt));
  await next.startContinues();
  if (second) {
    // The first goes at once, the second a minute later: read before `until`, which moves timers.
    time.by(60_000 - 1);
    expect(cache.turn(first.turn)?.continueAt).toBeNull();
    expect(cache.turn(second.turn)?.continueAt).not.toBeNull();
    time.by(1);
    expect(cache.turn(second.turn)?.continueAt).toBeNull();
  }
  time.by(Math.max(0, AFTER_RESET - Date.parse(startsAt)));
  await until(() => continues(adapter) === runs);
  expect(adapter.sent.at(-1)?.text).toBe(LIMIT_MESSAGE);
});

/** A timer that fires while the server stops claims nothing: the wait is the next start's. */
test("a wait whose time comes while the server stops is kept for the next start", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache, sessions } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { turn } = await sendLimited(setup, AGENT);

  await sessions.closeAll();
  time.to(AFTER_RESET);
  await flush();
  expect(cache.turn(turn)).toMatchObject({ continueAt: AFTER_RESET, continueReason: "limit" });
  expect(adapter.sent).toHaveLength(1);
});

/** A continue the cache fails to count leaves nothing half done: no turn, and the run asks. */
test("a continue that fails as it is queued leaves no turn behind", async () => {
  const setup = await testSessions(fixtureRepo(), { runs: () => ON });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { session, turn } = await sendLimited(setup, AGENT);
  vi.spyOn(cache, "addContinue").mockImplementationOnce(() => {
    throw new Error("database is locked");
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  time.to(AFTER_RESET);
  await flush();
  expect(cache.turns(session)).toHaveLength(1);
  expect(cache.turn(turn)).toMatchObject({ continueAt: null, continueReason: null });
  expect(cache.session(session)?.automaticContinues).toBe(0);
  time.by(HOUR);
  await flush();
  expect(adapter.sent).toHaveLength(1);
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
  { denials: [PUSH], limit: SESSION_LIMIT, name: "a blocked action", runs: ON },
])("a limit that is not continued fails and asks: $name", async ({ denials, limit, runs }) => {
  const setup = await testSessions(fixtureRepo(), { runs: () => runs });
  const { adapter, cache } = setup;
  const time = clock("2026-11-03T14:01:00Z");
  const { turn } = await sendLimited(setup, AGENT, limit, denials);

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
    // The decision reads the feature's commit: the run waits, or is capped, once it is made.
    await until(() => cache.turns(session).length === count + 1);
    await until(() => latest(cache, session).continueReason !== null);
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

/** Review focus 3, US2 2, US2's more scenarios 1 and 2, and the edge "the transcript is gone". */
test.each([
  { continues: true, name: "a run cut just now continues" },
  { continues: true, name: "a run continues once the agent is back", uninstalled: true },
  { continues: false, name: "a run cut 7 hours before does not", wait: 7 * HOUR },
  { continues: false, name: "a run whose transcript is gone does not", transcript: false },
  { continues: false, name: "a run of an older session does not", older: true },
  { continues: false, name: "a run of a repository no longer listed does not", unlisted: true },
  { continues: false, name: "a run whose restart continue is off does not", off: true },
  { continues: false, dismissed: true, name: "a run the human dismissed does not" },
  { continues: false, name: "a queued turn that never started does not", queued: true },
])(
  "US2.1: a run the restart cut continues at the next start, with its line: $name",
  async (row) => {
    const { continues: continued, dismissed, off, older, queued } = row;
    const { transcript, uninstalled, unlisted, wait } = row;
    const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
      runs: () => ON,
    });
    // The cache stamps the cut with the real time: the clock starts there.
    const time = clock(new Date().toISOString());
    const session = await sessions.featureSession(repo, AGENT);
    adapter.script([hold]);
    await sessions.send(repo, session.id, { text: "Write the plan", workflow: PLAN });
    await until(() => latest(cache, session.id).state === "running");
    if (queued) {
      adapter.capabilities.steer = false;
      await sessions.send(repo, session.id, { text: "Then the tasks" });
    }
    adapter.installed = uninstalled !== true;
    const next = await restart(sessions, {
      hosted: (root) => unlisted !== true || root !== session.repo,
      runs: () => (off === true ? { ...ON, afterRestart: false } : ON),
    });
    const cut = latest(cache, session.id);
    expect(cut).toMatchObject({ reason: "Stopped: the server stopped while it ran." });
    if (transcript === false) {
      adapter.sessions.delete(session.nativeId);
    }
    if (older) {
      await next.newSession(repo, AGENT);
    }
    if (dismissed) {
      next.dismiss(repo, cut.id);
    }
    time.by(wait ?? 0);
    const sent = adapter.sent.length;

    await next.startContinues();
    if (uninstalled) {
      // The agent is checked again: the scan waited for it.
      time.by(10_000);
      await flush();
      expect(adapter.sent).toHaveLength(sent);
      adapter.installed = true;
      await next.check();
    }
    time.by(10_000);
    if (continued) {
      await until(() => adapter.sent.length === sent + 1);
      expect(adapter.sent.at(-1)?.text).toBe(RESTART_MESSAGE);
      const turn = latest(cache, session.id);
      expect(turn).toMatchObject({ kind: "workflow", step: "plan" });
      expect(cache.items(turn.id, 0, 1)).toEqual([{ kind: "system", seq: 0, text: RESTART_LINE }]);
      return;
    }
    await flush();
    expect(adapter.sent).toHaveLength(sent);
    expect(latest(cache, session.id).id).toBe(cut.id);
    // A dismissed run asks for nothing.
    expect(statusOf(cache, cut.id).reason).toBe(dismissed ? undefined : "interrupted");
  },
);

/** US3's conditions: the gate's continue waits on the agent's step, and a run never blocked. */
test.each([
  { denials: [], gate: true, name: "once its step waits on the human" },
  { denials: [PUSH], gate: false, name: "with an action blocked" },
])("a run done before its gate is not asked to go on $name", async ({ denials, gate }) => {
  // The run writes its plan: the feature then waits on the human, at its gate.
  let atGate = false;
  const moving: Binding = {
    ...binding,
    readFeature: async (repo, folder) => {
      const feature = await binding.readFeature(repo, folder);
      const step = { ...feature.step, name: "human-gate", waitsOn: "human" };
      return atGate ? { ...feature, step } : feature;
    },
  };
  const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
    binding: moving,
    runs: () => ON,
  });
  const time = clock("2026-11-03T14:01:00Z");
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([
    () => {
      atGate = gate;
    },
    { denials, errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  const { turn } = await sessions.send(repo, session.id, { text: "Go on", workflow: PLAN });
  await sessions.settled(turn);

  time.by(HOUR);
  await flush();
  expect(cache.turn(turn)).toMatchObject({
    continueAt: null,
    continueReason: null,
    kind: "workflow",
  });
  expect(adapter.sent).toHaveLength(1);
});

test("US3: a run that stops before its gate is asked once, and a second stop asks for you", async () => {
  // SC-003: each end is published once decided, the first already waiting, never halted.
  const published: Array<string | undefined> = [];
  const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
    onChange: (change, cache) => {
      if ("turn" in change && change.state === "done") {
        published.push(statusOf(cache, change.turn!).reason);
      }
    },
    runs: () => ON,
  });
  const time = clock("2026-11-03T14:01:00Z");
  const session = await sessions.featureSession(repo, AGENT);
  // The run, then its continue, each end at `plan`, which waits on the agent.
  adapter.script([]);
  adapter.script([]);
  const { turn } = await sessions.send(repo, session.id, {
    text: "Write the plan",
    workflow: PLAN,
  });
  await sessions.settled(turn);

  time.by(0);
  await until(
    () => cache.turns(session.id).length === 2 && latest(cache, session.id).state === "done",
  );
  expect(adapter.sent.at(-1)?.text).toBe(GATE_MESSAGE);
  const asked = latest(cache, session.id);
  expect(cache.items(asked.id, 0, 1)).toEqual([{ kind: "system", seq: 0, text: GATE_LINE }]);

  // The second end is published once decided: then no continue is armed, however long it waits.
  await until(() => published.length === 2);
  time.by(HOUR);
  await flush();
  expect(sentOf(adapter, GATE_MESSAGE)).toBe(1);
  expect(cache.turns(session.id)).toHaveLength(2);
  expect(statusOf(cache, asked.id).reason).toBe("halted");
  expect(published).toEqual(["waiting", "halted"]);
});

/** US6: an agent that set a wakeup waits by it: the gate's continue never interrupts it. */
test("a run done before its gate with a pending wakeup is not asked, and works until it", async () => {
  const published: Array<string | undefined> = [];
  // The status reads the live process's wakeup through the manager, once it exists.
  const manager: { sessions?: Sessions } = {};
  const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
    onChange: (change, cache) => {
      const session = "session" in change ? change.session : undefined;
      const turn = session === undefined ? undefined : cache.turns(session).at(-1);
      if (session !== undefined && turn?.state === "done") {
        const wakeup = manager.sessions?.wakeup(session);
        published.push(statusOf(cache, turn.id, wakeup).reason);
      }
    },
    runs: () => ON,
  });
  manager.sessions = sessions;
  const time = clock("2026-11-03T14:01:00Z");
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([{ at: new Date(Date.now() + 25 * 60_000).toISOString(), type: "wakeup" }]);
  const { turn } = await sessions.send(repo, session.id, { text: "Wait for CI", workflow: PLAN });
  await sessions.settled(turn);

  time.by(25 * 60_000 - 1);
  await flush();
  expect(sentOf(adapter, GATE_MESSAGE)).toBe(0);
  expect(cache.turn(turn)).toMatchObject({ continueReason: null, state: "done" });
  expect(published.length).toBeGreaterThan(0);
  expect(published).not.toContain("halted");
  expect(statusOf(cache, turn, sessions.wakeup(session.id)).reason).toBe("waiting");
});

/** A gate past the cap was never asked: once the human sends the run on, its next stop is. */
test("a gate past the cap asks, and the next stop after the human's message goes on", async () => {
  const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
    runs: () => ({ ...ON, cap: 1 }),
  });
  const time = clock("2026-11-03T14:01:00Z");
  const session = await sessions.featureSession(repo, AGENT);
  // The run meets the limit, and its continue stops before the gate: past the cap of 1.
  limitTurn(adapter, SESSION_LIMIT);
  adapter.script([]);
  const { turn } = await sessions.send(repo, session.id, {
    text: "Write the plan",
    workflow: PLAN,
  });
  await sessions.settled(turn);
  time.to(AFTER_RESET);
  await until(() => latest(cache, session.id).continueReason === "gate");
  const capped = latest(cache, session.id);
  expect(capped).toMatchObject({ continueAt: null, state: "done" });
  expect(statusOf(cache, capped.id).reason).toBe("capped");

  adapter.script([]);
  adapter.script([]);
  const sent = await sessions.send(repo, session.id, { text: "Write the plan", workflow: PLAN });
  await sessions.settled(sent.turn);
  await until(() => sentOf(adapter, GATE_MESSAGE) === 1);
  expect(sentOf(adapter, GATE_MESSAGE)).toBe(1);
});

/** US4 2: what the run committed is progress, so its continues start counting again. */
test("US4.2: a commit on the branch sets the count back to 0", async () => {
  const runs = { ...ON, cap: 2 };
  // The decisions read the worktree the feature has: only a process opening asks for one.
  let workDirs = 0;
  const counted: Binding = {
    ...binding,
    workDir: (repo, folder) => {
      workDirs += 1;
      return binding.workDir(repo, folder);
    },
  };
  const { adapter, cache, repo, sessions } = await testSessions(fixtureRepo(), {
    binding: counted,
    runs: () => runs,
  });
  const time = clock("2026-11-03T14:01:00Z");
  const session = await sessions.featureSession(repo, AGENT);
  const count = () => cache.session(session.id)?.automaticContinues;
  // The run stops before its gate; its gate's continue meets the limit; the limit's continue
  // commits, then stops before the gate again.
  adapter.script([]);
  limitTurn(adapter, SESSION_LIMIT);
  adapter.script([() => commitOnBranch(repo, AGENT, { "notes.md": "The plan's notes.\n" })]);
  const { turn } = await sessions.send(repo, session.id, {
    text: "Write the plan",
    workflow: PLAN,
  });
  await sessions.settled(turn);
  time.by(0);
  await until(() => latest(cache, session.id).continueReason === "limit");
  expect(count()).toBe(1);

  time.to(AFTER_RESET);
  await until(() => sentOf(adapter, GATE_MESSAGE) === 2);
  expect(sentOf(adapter, LIMIT_MESSAGE)).toBe(1);
  expect(cache.turns(session.id)).toHaveLength(4);
  // At the cap of 2 without the commit, the gate's continue went: 0, then this one.
  expect(count()).toBe(1);
  expect(workDirs).toBe(adapter.opens.length);
});
