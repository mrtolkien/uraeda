import { afterEach, expect, test, vi } from "vite-plus/test";
import type { AgentEvent } from "../events.ts";
import { CLEARED, FRESH } from "../session-state.ts";
import { IDLE_CLOSE_MS } from "../sessions.ts";
import { flush, testSessions } from "./helpers.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

/** The agent session's running total, as the adapter reports it before each result. */
const TOTAL = (input: number, cacheWrite: number, cacheRead: number, output: number) =>
  ({ total: { cacheRead, cacheWrite, input, output }, type: "tokens" }) as const;

const counts = (input: number, cacheWrite: number, cacheRead: number, output: number) => ({
  cacheRead,
  cacheWrite,
  input,
  output,
});

const done: AgentEvent = { denials: [], errors: [], interrupted: false, ok: true, type: "result" };

afterEach(() => {
  vi.useRealTimers();
});

/** A session on a feature waiting on its agent, and a function that sends a message and waits. */
async function featureSession(options?: Parameters<typeof testSessions>[1]) {
  const context = await testSessions(undefined, options);
  const { repo, sessions } = context;
  const session = await sessions.featureSession(repo, AGENT);
  const send = async (text: string, workflow?: { fresh: boolean; trigger: "manual" }) => {
    const { turn } = await sessions.send(repo, session.id, {
      text,
      ...(workflow ? { workflow } : {}),
    });
    await sessions.settled(turn);
    return turn;
  };
  return { ...context, send, session };
}

/** Lets the idle process close, so the next message opens a new one. */
async function idle() {
  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  await flush();
}

test("a turn stores its own tokens", async () => {
  const { adapter, cache, send } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);

  const turn = await send("First");

  expect(cache.turn(turn)?.tokens).toEqual(counts(2, 7791, 11_304, 4));
});

test("a turn without a report has no counts", async () => {
  const { adapter, cache, send } = await featureSession();
  adapter.script([]);

  const turn = await send("First");

  expect(cache.turn(turn)?.tokens).toBeNull();
});

test("the second turn of a process counts only its own work", async () => {
  const { adapter, cache, send } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);
  adapter.script([TOTAL(4, 13_558, 24_671, 8)]);

  await send("First");
  const second = await send("Second");

  expect(adapter.opens).toHaveLength(1);
  expect(cache.turn(second)?.tokens).toEqual(counts(2, 5767, 13_367, 4));
});

test("a resumed process starts from the agent session's recorded total", async () => {
  const { adapter, cache, send } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);
  await send("First");
  await idle();

  // The resumed agent's first total already holds the first turn's.
  adapter.script([TOTAL(4, 13_558, 24_671, 8)]);
  const second = await send("Second");

  expect(adapter.opens[1]).toMatchObject({ resume: true });
  expect(cache.turn(second)?.tokens).toEqual(counts(2, 5767, 13_367, 4));
});

test("a fresh agent session starts from zero, and its resumed process from its own turns", async () => {
  const { adapter, cache, send, session } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);
  await send("First");

  adapter.script([TOTAL(3, 5000, 9000, 6)]);
  const fresh = await send("Continue the feature.", { fresh: true, trigger: "manual" });
  expect(adapter.opens[1]).toMatchObject({ resume: false });
  expect(cache.turn(fresh)?.tokens).toEqual(counts(3, 5000, 9000, 6));

  await idle();
  adapter.script([TOTAL(5, 6000, 20_000, 10)]);
  const resumed = await send("And now?");

  expect(adapter.opens[2]).toMatchObject({ nativeId: adapter.opens[1]?.nativeId, resume: true });
  expect(cache.turn(resumed)?.tokens).toEqual(counts(2, 1000, 11_000, 4));
  expect(cache.agentSessionTokens(session.id)).toEqual(counts(5, 6000, 20_000, 10));
});

test("two results in one steered turn add up", async () => {
  const { adapter, cache, repo, session, sessions } = await featureSession();
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Use the existing helper" });

  // The first result comes before the agent read the steered message: the turn goes on.
  adapter.emit({ id: adapter.sent[0]!.id, type: "accepted" });
  adapter.emit(TOTAL(2, 7791, 11_304, 4));
  adapter.emit(done);
  await flush();
  expect(cache.turn(turn)?.state).toBe("running");

  adapter.emit({ id: adapter.sent[1]!.id, type: "accepted" });
  adapter.emit(TOTAL(4, 13_558, 24_671, 8));
  adapter.emit(done);
  await sessions.settled(turn);

  expect(cache.turn(turn)?.tokens).toEqual(counts(4, 13_558, 24_671, 8));
});

test("a turn killed before its result has no counts, and the next one absorbs its work", async () => {
  const { adapter, cache, repo, send, session, sessions } = await featureSession();
  const { turn: killed } = await sessions.send(repo, session.id, { text: "Plan it" });
  adapter.exit(137);
  await sessions.settled(killed);
  expect(cache.turn(killed)?.tokens).toBeNull();

  // The resumed agent's total holds the killed turn's work too.
  adapter.script([TOTAL(10, 9000, 30_000, 12)]);
  const next = await send("Again");

  expect(adapter.opens[1]).toMatchObject({ resume: true });
  expect(cache.turn(next)?.tokens).toEqual(counts(10, 9000, 30_000, 12));
  expect(cache.agentSessionTokens(session.id)).toEqual(counts(10, 9000, 30_000, 12));
});

test("a REPLACED agent session starts from zero, and its resumed process from its own turns", async () => {
  const { adapter, cache, send, session } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);
  await send("First");
  await idle();

  // Claude Code deleted the transcript: a new agent session starts, saying so.
  adapter.sessions.clear();
  adapter.script([TOTAL(3, 5000, 9000, 6)]);
  const replaced = await send("Second");
  expect(adapter.opens[1]).toMatchObject({ resume: false });
  expect(cache.turn(replaced)?.tokens).toEqual(counts(3, 5000, 9000, 6));

  await idle();
  adapter.script([TOTAL(5, 6000, 20_000, 10)]);
  const resumed = await send("And now?");

  expect(adapter.opens[2]).toMatchObject({ nativeId: adapter.opens[1]?.nativeId, resume: true });
  expect(cache.turn(resumed)?.tokens).toEqual(counts(2, 1000, 11_000, 4));
  expect(cache.agentSessionTokens(session.id)).toEqual(counts(5, 6000, 20_000, 10));
});

/** An `init` with a new session ID: `/clear` started a new agent session in the same process. */
const cleared = (sessionId: string): AgentEvent => ({
  pluginErrors: [],
  plugins: ["uraeda"],
  sessionId,
  type: "init",
});

test("/clear starts a new agent session in the process: its total is the turn's own", async () => {
  const { adapter, cache, send } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);
  await send("First");

  adapter.script([cleared("cleared-1"), TOTAL(1, 100, 200, 1)]);
  const clear = await send("/clear");

  expect(adapter.opens).toHaveLength(1);
  expect(cache.turn(clear)?.tokens).toEqual(counts(1, 100, 200, 1));
  expect(cache.itemsOf(clear, "system").map((item) => item.text)).toEqual([CLEARED]);
});

test("/clear's new agent session counts its whole total, even above the old one's", async () => {
  const { adapter, cache, send } = await featureSession();
  adapter.script([TOTAL(10, 10, 10, 10)]);
  await send("First");

  adapter.script([cleared("cleared-1"), TOTAL(30, 30, 30, 30)]);
  const clear = await send("/clear");

  expect(adapter.opens).toHaveLength(1);
  expect(cache.turn(clear)?.tokens).toEqual(counts(30, 30, 30, 30));
});

test("a process resumed after /clear starts from the new agent session's turns", async () => {
  const { adapter, cache, send, session } = await featureSession();
  adapter.script([TOTAL(2, 7791, 11_304, 4)]);
  await send("First");
  adapter.script([cleared("cleared-1"), TOTAL(1, 100, 200, 1)]);
  await send("/clear");
  await idle();

  // Claude Code keeps the cleared agent session's transcript: the next process resumes it.
  adapter.sessions.add("cleared-1");
  adapter.script([TOTAL(3, 300, 600, 3)]);
  const resumed = await send("And now?");

  expect(adapter.opens[1]).toMatchObject({ nativeId: "cleared-1", resume: true });
  expect(cache.turn(resumed)?.tokens).toEqual(counts(2, 200, 400, 2));
  expect(cache.agentSessionTokens(session.id)).toEqual(counts(3, 300, 600, 3));
});

test("a fresh turn taken back while its process opens leaves its line to the next turn", async () => {
  // The second worktree read, the fresh process's, waits until the test lets it go.
  let reads = 0;
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  const { adapter, cache, repo, send, session, sessions } = await featureSession({
    binding: {
      ...binding,
      workDir: async (...args: Parameters<typeof binding.workDir>) => {
        if (++reads === 2) {
          await held;
        }
        return binding.workDir(...args);
      },
    },
  });
  const { turn: first } = await sessions.send(repo, session.id, { text: "What is left?" });
  const { turn: fresh } = await sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { fresh: true, trigger: "manual" },
  });
  const { turn: next } = await sessions.send(repo, session.id, {
    text: "Go on.",
    workflow: { fresh: false, trigger: "manual" },
  });
  adapter.emit({ id: adapter.sent[0]!.id, type: "accepted" });
  adapter.emit(TOTAL(2, 7791, 11_304, 4));
  adapter.emit(done);
  await sessions.settled(first);
  await vi.waitFor(() => expect(reads).toBe(2));

  sessions.takeBack(repo, session.id, cache.itemsOf(fresh, "message")[0]!.id);
  adapter.script([TOTAL(3, 5000, 9000, 6)]);
  release();
  await sessions.settled(next);

  expect(adapter.opens[1]).toMatchObject({ resume: false });
  expect(cache.itemsOf(next, "system").map((item) => item.text)).toEqual([FRESH]);
  expect(cache.turn(next)?.tokens).toEqual(counts(3, 5000, 9000, 6));

  await idle();
  adapter.script([TOTAL(5, 6000, 20_000, 10)]);
  const resumed = await send("And now?");

  expect(adapter.opens[2]).toMatchObject({ resume: true });
  expect(cache.turn(resumed)?.tokens).toEqual(counts(2, 1000, 11_000, 4));
});
