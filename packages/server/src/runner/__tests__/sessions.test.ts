import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { AgentEvent } from "../events.ts";
import {
  IDLE_CLOSE_MS,
  OUTPUT_LIMIT,
  RESUMED,
  TERMINATE_AFTER_MS,
  WATCHDOG_MS,
} from "../sessions.ts";
import { flush, testSessions } from "./helpers.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

const opening = (folder: string) =>
  `A human is chatting with you about the feature specs/${folder}/, on branch ${folder}: answer, ` +
  "and change files, commit, or move the workflow only when they ask.";

const done = (extra: Partial<Extract<AgentEvent, { type: "result" }>> = {}): AgentEvent => ({
  denials: [],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result",
  ...extra,
});

afterEach(() => {
  vi.useRealTimers();
});

test("US1.1: a chat message on a feature waiting on the human goes with the opening line", async () => {
  const { adapter, cache, changes, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, HUMAN);
  adapter.script([{ text: "Because A keeps one process.", type: "text" }]);

  const { turn } = await sessions.send(repo, session.id, {
    text: "Why did you recommend A in Q6?",
  });
  await sessions.settled(turn);

  expect(adapter.opens).toHaveLength(1);
  expect(adapter.opens[0]).toMatchObject({
    cwd: join(repo, ".worktrees", HUMAN),
    nativeId: session.nativeId,
    resume: false,
  });
  expect(adapter.sent[0]?.text).toBe(`${opening(HUMAN)}\nWhy did you recommend A in Q6?`);
  expect(cache.turn(turn)).toMatchObject({ kind: "chat", state: "done", trigger: null });
  expect(cache.items(turn, 0, 10)).toEqual([
    {
      at: expect.any(String),
      id: adapter.sent[0]?.id,
      kind: "message",
      opening: opening(HUMAN),
      origin: "human",
      seq: 0,
      state: "read",
      text: "Why did you recommend A in Q6?",
    },
    { kind: "text", seq: 1, streaming: false, text: "Because A keeps one process." },
  ]);
  expect((await binding.nextStep(repo, HUMAN)).step.waitsOn).toBe("human");
  expect(changes).toContainEqual({
    folder: HUMAN,
    repo,
    session: session.id,
    state: "running",
    turn,
  });
  expect(changes).toContainEqual({ folder: HUMAN, repo, session: session.id, state: "done", turn });
  expect(changes).toContainEqual({ folder: HUMAN, repo, session: session.id, turn });
});

test("US1.2: a second message goes without the opening line, on the same process", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, HUMAN);
  adapter.script([]);
  adapter.script([]);

  await sessions.settled((await sessions.send(repo, session.id, { text: "First" })).turn);
  const { turn } = await sessions.send(repo, session.id, { text: "Second" });
  await sessions.settled(turn);

  expect(adapter.opens).toHaveLength(1);
  expect(adapter.sent[1]?.text).toBe("Second");
  const [message] = cache.items(turn, 0, 1);
  expect(message).not.toHaveProperty("opening");
  expect(message).toMatchObject({ kind: "message", state: "read", text: "Second" });
});

test("US1.3: a message sent during a turn is steered into it", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  const steered = await sessions.send(repo, session.id, { text: "Use the existing helper" });

  expect(steered.turn).toBe(turn);
  expect(adapter.sent[1]).toMatchObject({ text: "Use the existing helper", when: "steer" });
  const item = () => cache.items(turn, 0, 10).find((each) => each.seq === 1);
  expect(item()).toMatchObject({ kind: "message", state: "pending" });

  adapter.emit({ id: adapter.sent[0]!.id, type: "accepted" });
  adapter.emit({ id: adapter.sent[1]!.id, type: "accepted" });
  await flush();
  expect(item()).toMatchObject({ kind: "message", state: "read" });

  adapter.emit(done());
  await sessions.settled(turn);
  expect(cache.turns(session.id)).toHaveLength(1);
  expect(cache.turn(turn)?.state).toBe("done");
});

test("US1.4: a pending message can be taken back", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Never mind" });
  const message = adapter.sent[1]!.id;

  sessions.takeBack(repo, session.id, message);
  expect(adapter.takenBack).toEqual([message]);
  adapter.emit({ id: message, type: "cancelled" });
  await flush();
  expect(cache.itemsOf(turn, "message").find((each) => each.id === message)?.state).toBe(
    "taken-back",
  );

  await sessions.send(repo, session.id, { text: "Use the helper" });
  const read = adapter.sent[2]!.id;
  adapter.emit({ id: read, type: "accepted" });
  await flush();
  expect(() => sessions.takeBack(repo, session.id, read)).toThrow(
    "refused: The agent already read it.",
  );
  expect(adapter.takenBack).toEqual([message]);
});

test("a turn that fails takes back the message steered into it, which no turn would record", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Use the helper" });
  const steered = adapter.sent[1]!.id;

  adapter.emit(done({ errors: ["API error"], ok: false }));
  await sessions.settled(turn);

  expect(cache.turn(turn)).toMatchObject({ reason: "API error", state: "failed" });
  expect(adapter.takenBack).toEqual([steered]);
  expect(cache.itemsOf(turn, "message").find((each) => each.id === steered)?.state).toBe(
    "taken-back",
  );
});

test("a turn's messages are forgotten once it ended and none waits to be read", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const first = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Use the helper" });
  adapter.emit({ id: adapter.sent[0]!.id, type: "accepted" });
  adapter.emit({ id: adapter.sent[1]!.id, type: "accepted" });
  adapter.emit(done());
  await sessions.settled(first.turn);
  expect(sessions.tracked(session.id)).toBe(0);

  // A message steered into a stopped turn is kept until the agent says it is taken back.
  const second = await sessions.send(repo, session.id, { text: "Go on" });
  await sessions.send(repo, session.id, { text: "Never mind" });
  adapter.ignoreInterrupt = true;
  sessions.stop(repo, session.id);
  adapter.emit(done({ interrupted: true, ok: false }));
  await sessions.settled(second.turn);
  expect(sessions.tracked(session.id)).toBe(1);
  adapter.emit({ id: adapter.sent[3]!.id, type: "cancelled" });
  await flush();
  expect(sessions.tracked(session.id)).toBe(0);
});

test("a message of a turn that ended is refused as read, from a tab that still shows it pending", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Use the helper" });
  const steered = adapter.sent[1]!.id;
  adapter.emit({ id: adapter.sent[0]!.id, type: "accepted" });
  adapter.emit({ id: steered, type: "accepted" });
  adapter.emit(done());
  await sessions.settled(turn);

  expect(() => sessions.takeBack(repo, session.id, steered)).toThrow(
    "refused: The agent already read it.",
  );
});

test("US1.5: Stop interrupts the turn and keeps the process", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const first = await sessions.send(repo, session.id, { text: "Plan it" });

  sessions.stop(repo, session.id);
  await sessions.settled(first.turn);

  expect(adapter.interrupts).toBe(1);
  expect(adapter.kills).toEqual([]);
  expect(cache.turn(first.turn)?.state).toBe("stopped");

  // The same process answers the next message, and its turn ignores the interrupt.
  adapter.ignoreInterrupt = true;
  const second = await sessions.send(repo, session.id, { text: "Go on" });
  expect(adapter.opens).toHaveLength(1);
  sessions.stop(repo, session.id);
  vi.advanceTimersByTime(TERMINATE_AFTER_MS);
  expect(adapter.kills).toEqual(["SIGINT"]);
  vi.advanceTimersByTime(TERMINATE_AFTER_MS);
  expect(adapter.kills).toEqual(["SIGINT", "SIGTERM"]);
  await sessions.settled(second.turn);
  expect(cache.turn(second.turn)?.state).toBe("stopped");
});

test("US1.6: a feature's writes are refused while its turn runs", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  expect(sessions.working(repo)).toEqual([AGENT]);

  adapter.emit(done());
  await sessions.settled(turn);
  expect(sessions.working(repo)).toEqual([]);
});

test("US1.7 and C1: an idle process closes after 15 minutes, and the next message resumes the same session", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Plan it" })).turn);

  vi.advanceTimersByTime(IDLE_CLOSE_MS - 1);
  expect(adapter.closes).toBe(0);
  vi.advanceTimersByTime(1);
  expect(adapter.closes).toBe(1);
  await flush();

  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "And now?" })).turn);
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({ nativeId: adapter.opens[0]!.nativeId, resume: true });
});

test("a turn reopens when its agent goes on by itself after it ended, and its process stays open", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Implement it" });
  // A background shell does not hold the turn: shells and watchers may never end.
  adapter.emit({ id: "bash-1", input: {}, kind: "execute", name: "Bash", type: "toolStart" });
  adapter.emit({ id: "bash-1", isError: false, output: "Running in background.", type: "toolEnd" });
  adapter.emit({ text: "The baseline runs.", type: "text" });
  adapter.emit(done());
  await sessions.settled(turn);
  expect(cache.turn(turn)).toMatchObject({ state: "done" });

  // The shell reports back: the agent goes on, in the same turn.
  vi.advanceTimersByTime(IDLE_CLOSE_MS - 1);
  adapter.emit({ text: "The baseline passed.", type: "text" });
  await flush();
  expect(cache.turn(turn)).toMatchObject({ endedAt: null, state: "running" });
  expect(sessions.working(repo)).toEqual([AGENT]);
  expect(cache.items(turn, 0, 10).slice(-2)).toMatchObject([
    { kind: "system", text: RESUMED },
    { kind: "text", text: "The baseline passed." },
  ]);
  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  expect(adapter.closes).toBe(0);

  adapter.emit(done());
  await sessions.settled(turn);
  expect(cache.turn(turn)).toMatchObject({ state: "done" });
  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  expect(adapter.closes).toBe(1);
});

test("a closed process that keeps running gets SIGTERM, so the next message does not wait on it forever", async () => {
  const { adapter, repo, sessions } = await testSessions();
  adapter.ignoreClose = true;
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Plan it" })).turn);
  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  expect(adapter.closes).toBe(1);

  adapter.script([]);
  let sent = false;
  const next = sessions.send(repo, session.id, { text: "And now?" }).then((result) => {
    sent = true;
    return result;
  });
  await flush();
  expect([sent, adapter.kills]).toEqual([false, []]);

  vi.advanceTimersByTime(TERMINATE_AFTER_MS);
  expect(adapter.kills).toEqual(["SIGTERM"]);
  await sessions.settled((await next).turn);
  expect(adapter.opens).toHaveLength(2);
});

test("the server's stop kills a process that ignores its close and SIGTERM", async () => {
  const { adapter, repo, sessions } = await testSessions();
  adapter.ignoreClose = true;
  adapter.ignoreTerm = true;
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Plan it" })).turn);

  let closed = false;
  const closing = sessions.closeAll().then(() => (closed = true));
  vi.advanceTimersByTime(TERMINATE_AFTER_MS);
  await flush();
  expect([closed, adapter.kills]).toEqual([false, ["SIGTERM"]]);
  vi.advanceTimersByTime(TERMINATE_AFTER_MS);
  await closing;
  expect(adapter.kills).toEqual(["SIGTERM", "SIGKILL"]);
});

test("a session is forgotten once its process exited with nothing left to run", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Plan it" })).turn);
  expect(sessions.held(session.id)).toBe(true);

  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  await flush();
  expect(sessions.held(session.id)).toBe(false);

  // Stop on a session with nothing running keeps nothing either.
  sessions.stop(repo, session.id);
  expect(sessions.held(session.id)).toBe(false);
});

test("US2.2: a workflow message starts a workflow turn", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  const text = "/uraeda:uraeda Continue the feature.\nKeep the plan short.";

  const { turn } = await sessions.send(repo, session.id, {
    text,
    workflow: { trigger: "manual" },
  });
  await sessions.settled(turn);

  expect(adapter.sent[0]?.text).toBe(text);
  expect(cache.turn(turn)).toMatchObject({
    kind: "workflow",
    state: "done",
    step: "plan",
    trigger: "manual",
  });
  const [message] = cache.items(turn, 0, 1);
  expect(message).toMatchObject({ kind: "message", origin: "workflow", text });
  expect(message).not.toHaveProperty("opening");
});

test("US2.4: a workflow message on a feature waiting on the human is refused", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, HUMAN);

  await expect(
    sessions.send(repo, session.id, { text: "Continue", workflow: { trigger: "manual" } }),
  ).rejects.toThrow("refused: The feature waits on you now: there is nothing to continue.");
  expect(adapter.opens).toEqual([]);
  expect(cache.turns(session.id)).toEqual([]);
});

test("US2.5: a workflow message during a chat turn is queued, and starts after it", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const chat = await sessions.send(repo, session.id, { text: "What is left?" });

  const workflow = await sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });

  expect(workflow.turn).not.toBe(chat.turn);
  expect(cache.turn(workflow.turn)?.state).toBe("queued");
  expect(adapter.sent).toHaveLength(1);
  expect(sessions.working(repo)).toEqual([AGENT]);

  adapter.script([]);
  adapter.emit(done());
  await sessions.settled(chat.turn);
  await flush();
  expect(adapter.sent[1]?.text).toBe("Continue the feature.");
  await sessions.settled(workflow.turn);
  expect(cache.turn(chat.turn)?.state).toBe("done");
  expect(cache.turn(workflow.turn)).toMatchObject({ kind: "workflow", state: "done" });
  expect(adapter.opens).toHaveLength(1);
});

test("US4.1: a new chat works in the main checkout, without an opening line, and is titled by its first line", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  expect(chat).toMatchObject({ agent: "fake", folder: null, repo, title: null });
  adapter.script([]);

  const { turn } = await sessions.send(repo, chat.id, { text: "List the open draft files" });
  await sessions.settled(turn);

  expect(adapter.opens[0]?.cwd).toBe(repo);
  expect(adapter.sent[0]?.text).toBe("List the open draft files");
  expect(cache.items(turn, 0, 1)[0]).not.toHaveProperty("opening");
  expect(cache.session(chat.id)?.title).toBe("List the open draft files");
});

test("US4.3: sending to an archived chat brings it back", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);

  sessions.archive(repo, chat.id, true);
  expect(cache.session(chat.id)?.archivedAt).not.toBeNull();
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Back" })).turn);

  expect(cache.session(chat.id)?.archivedAt).toBeNull();
  // The title is the first message's.
  expect(cache.session(chat.id)?.title).toBe("Hello");
});

test("US4.4: no agent: sends are refused", async () => {
  const { adapter, repo, sessions } = await testSessions();
  adapter.installed = false;
  await sessions.check();
  const chat = await sessions.newChat(repo);

  expect(sessions.status()).toEqual({ available: false, version: null });
  await expect(sessions.send(repo, chat.id, { text: "Hello" })).rejects.toThrow(
    "refused: Claude Code is not available on this machine.",
  );
  expect(adapter.opens).toEqual([]);
});

/** A feature's session whose first turn ended with `git push` blocked. */
async function blockedPush() {
  const setup = await testSessions();
  const { adapter, cache, repo, sessions } = setup;
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([
    done({ denials: [{ input: { command: "git push origin HEAD" }, tool: "Bash" }] }),
  ]);
  const { turn } = await sessions.send(repo, session.id, { text: "Push it" });
  await sessions.settled(turn);
  const [denial] = cache.itemsOf(turn, "denial");
  return { ...setup, denial: denial!, session, turn };
}

test("US5.2: Allow and retry reopens the process with the rule and sends the retry message", async () => {
  const { adapter, cache, denial, repo, session, sessions, turn } = await blockedPush();
  expect(denial).toMatchObject({
    allowed: false,
    rule: "Bash(git push origin HEAD)",
    target: "git push origin HEAD",
    tool: "Bash",
  });
  adapter.script([]);

  const allowed = await sessions.allow(repo, session.id, turn, denial.seq);
  await sessions.settled(allowed.turn);

  expect(adapter.closes).toBe(1);
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({
    allowed: "Bash(git push origin HEAD)",
    nativeId: adapter.opens[0]!.nativeId,
    resume: true,
  });
  expect(adapter.sent.at(-1)?.text).toBe(
    "Try the blocked action again, now allowed: Bash git push origin HEAD",
  );
  expect(cache.itemsOf(turn, "denial")[0]?.allowed).toBe(true);
  expect(cache.turn(allowed.turn)).toMatchObject({
    allowed: "Bash(git push origin HEAD)",
    kind: "allow",
    state: "done",
  });
  expect(cache.items(allowed.turn, 0, 1)[0]).toMatchObject({
    kind: "message",
    origin: "human",
    text: "Try the blocked action again, now allowed: Bash git push origin HEAD",
  });
});

test("a blocked command with a `*` is shown without a rule, and allowing it is refused", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([done({ denials: [{ input: { command: "rm -rf build/*" }, tool: "Bash" }] })]);
  const { turn } = await sessions.send(repo, session.id, { text: "Clean" });
  await sessions.settled(turn);
  const [denial] = cache.itemsOf(turn, "denial");

  expect(denial).toMatchObject({ allowed: false, target: "rm -rf build/*", tool: "Bash" });
  expect(denial).not.toHaveProperty("rule");
  await expect(sessions.allow(repo, session.id, turn, denial!.seq)).rejects.toThrow(
    "refused: No allow rule can match only this action.",
  );
  expect(adapter.opens).toHaveLength(1);
});

test("US5.3: the rule ends with its process", async () => {
  const { adapter, denial, repo, session, sessions, turn } = await blockedPush();
  adapter.script([]);
  await sessions.settled((await sessions.allow(repo, session.id, turn, denial.seq)).turn);

  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  await flush();
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Thanks" })).turn);

  expect(adapter.opens).toHaveLength(3);
  expect(adapter.opens[2]).not.toHaveProperty("allowed");
  expect(adapter.opens[2]?.resume).toBe(true);
});

test("a gone transcript starts a new session, which says so", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Hello" })).turn);
  vi.advanceTimersByTime(IDLE_CLOSE_MS);
  await flush();
  adapter.sessions.clear();

  adapter.script([]);
  const { turn } = await sessions.send(repo, session.id, { text: "Again" });
  await sessions.settled(turn);

  expect(adapter.opens[1]?.resume).toBe(false);
  expect(adapter.opens[1]?.nativeId).not.toBe(adapter.opens[0]?.nativeId);
  expect(cache.session(session.id)?.nativeId).toBe(adapter.opens[1]?.nativeId);
  expect(cache.items(turn, 0, 1)).toEqual([
    { kind: "system", seq: 0, text: "Started a new session: the previous one is gone." },
  ]);
});

test("the process exits during a turn: it fails with its stderr", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  const first = await sessions.send(repo, session.id, { text: "Plan it" });
  adapter.exit(1, "starting\nout of memory\n");
  await sessions.settled(first.turn);
  expect(cache.turn(first.turn)).toMatchObject({
    reason: "starting\nout of memory",
    state: "failed",
  });

  const second = await sessions.send(repo, session.id, { text: "Again" });
  adapter.exit(2);
  await sessions.settled(second.turn);
  expect(cache.turn(second.turn)).toMatchObject({
    reason: "Claude Code exited with code 2.",
    state: "failed",
  });
});

test("the process exits between turns: the next message resumes it", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Hello" })).turn);

  adapter.exit(137);
  await flush();
  adapter.script([]);
  const { turn } = await sessions.send(repo, session.id, { text: "Still there?" });
  await sessions.settled(turn);

  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({ nativeId: adapter.opens[0]!.nativeId, resume: true });
  expect(cache.turn(turn)?.state).toBe("done");
});

test("an interrupted result with no text ends the turn as stopped", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  adapter.emit(done({ errors: ["[ede_diagnostic] aborted"], interrupted: true, ok: false }));
  await sessions.settled(turn);

  expect(cache.turn(turn)).toMatchObject({ reason: null, state: "stopped" });
});

test("an init with a new session ID updates the native ID", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  await sessions.send(repo, session.id, { text: "/clear" });

  adapter.emit({ pluginErrors: [], plugins: ["uraeda"], sessionId: "cleared-1", type: "init" });
  await flush();

  expect(cache.session(session.id)?.nativeId).toBe("cleared-1");
});

test("a feature with no branch refuses with 'This feature has no branch yet: commit its proposal first.'", async () => {
  const repo = fixtureRepo();
  const folder = "2026-10-20-draft";
  mkdirSync(join(repo, "specs", folder));
  writeFileSync(join(repo, "specs", folder, "proposal.md"), "# Draft\n\n## What\n\nA draft.\n");
  const { adapter, sessions } = await testSessions(repo);
  expect((await binding.nextStep(repo, folder)).branch).toBeUndefined();
  const session = await sessions.featureSession(repo, folder);

  await expect(sessions.send(repo, session.id, { text: "Hello" })).rejects.toThrow(
    "refused: This feature has no branch yet: commit its proposal first.",
  );
  expect(adapter.opens).toEqual([]);
});

test("the watchdog fails a silent turn after 30 minutes with 'No output for 30 minutes.'", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  // Output keeps it going.
  vi.advanceTimersByTime(WATCHDOG_MS - 1);
  adapter.emit({ text: "Thinking", type: "textDelta" });
  await flush();
  vi.advanceTimersByTime(WATCHDOG_MS - 1);
  expect(cache.turn(turn)?.state).toBe("running");

  vi.advanceTimersByTime(1);
  await sessions.settled(turn);
  expect(cache.turn(turn)).toMatchObject({ reason: "No output for 30 minutes.", state: "failed" });
});

test("a plugin that does not load fails the turn with 'The Uraeda skill did not load: <error>'", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.autoInit = false;
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  adapter.emit({
    pluginErrors: ["no manifest", "bad skill"],
    plugins: [],
    sessionId: session.nativeId,
    type: "init",
  });
  await sessions.settled(turn);
  await flush();

  expect(cache.turn(turn)).toMatchObject({
    reason: "The Uraeda skill did not load: no manifest; bad skill",
    state: "failed",
  });
  expect(adapter.closes).toBe(1);
});

test("a process whose plugins leave out uraeda, with no error, fails the turn too", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.autoInit = false;
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  adapter.emit({
    pluginErrors: [],
    plugins: ["cc-plugin-telemetry"],
    sessionId: session.nativeId,
    type: "init",
  });
  await sessions.settled(turn);
  await flush();

  expect(cache.turn(turn)).toMatchObject({
    reason: "The Uraeda skill did not load: the plugins loaded were cc-plugin-telemetry",
    state: "failed",
  });
  expect(adapter.closes).toBe(1);
});

test("review focus 1: a message sent before the process's init is sent once", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.autoInit = false;
  const session = await sessions.featureSession(repo, AGENT);

  // Both are sent at once: the second while the first is still opening the process.
  const [first, second] = await Promise.all([
    sessions.send(repo, session.id, { text: "Plan it" }),
    sessions.send(repo, session.id, { text: "Keep it short" }),
  ]);
  adapter.emit({
    pluginErrors: [],
    plugins: ["uraeda"],
    sessionId: session.nativeId,
    type: "init",
  });
  await flush();

  expect(adapter.opens).toHaveLength(1);
  expect(second.turn).toBe(first.turn);
  expect(adapter.sent.map(({ text, when }) => ({ text, when }))).toEqual([
    { text: `${opening(AGENT)}\nPlan it`, when: "queue" },
    { text: "Keep it short", when: "steer" },
  ]);
  expect(cache.itemsOf(first.turn, "message").map(({ text }) => text)).toEqual([
    "Plan it",
    "Keep it short",
  ]);
});

test("review focus 2: a queued turn starts on a reopened process when the process died", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const chat = await sessions.send(repo, session.id, { text: "What is left?" });
  const workflow = await sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  adapter.script([]);

  adapter.exit(1, "crashed");
  await sessions.settled(chat.turn);
  await sessions.settled(workflow.turn);

  expect(cache.turn(chat.turn)).toMatchObject({ reason: "crashed", state: "failed" });
  expect(cache.turn(workflow.turn)?.state).toBe("done");
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({ nativeId: adapter.opens[0]!.nativeId, resume: true });
  expect(adapter.sent.map(({ text }) => text)).toEqual([
    `${opening(AGENT)}\nWhat is left?`,
    "Continue the feature.",
  ]);
});

test.each(["stop", "take back"])(
  "a queued turn ended by %s while its process reopens does not start",
  async (end) => {
    // The second worktree read, the reopening's, waits until the test lets it go.
    let reads = 0;
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    const { adapter, cache, repo, sessions } = await testSessions(undefined, {
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
    const session = await sessions.featureSession(repo, AGENT);
    const chat = await sessions.send(repo, session.id, { text: "What is left?" });
    const workflow = await sessions.send(repo, session.id, {
      text: "Continue the feature.",
      workflow: { trigger: "manual" },
    });
    adapter.script([]);
    adapter.exit(1, "crashed");
    await sessions.settled(chat.turn);
    await vi.waitFor(() => expect(reads).toBe(2));

    if (end === "stop") {
      sessions.stop(repo, session.id);
    } else {
      sessions.takeBack(repo, session.id, cache.itemsOf(workflow.turn, "message")[0]!.id);
    }
    release();
    // The process opens all the same, and waits for the next message.
    await vi.waitFor(() => expect(adapter.opens).toHaveLength(2));
    await flush();

    expect(cache.turn(workflow.turn)?.state).toBe("stopped");
    expect(adapter.sent.map(({ text }) => text)).toEqual([`${opening(AGENT)}\nWhat is left?`]);
    expect(sessions.working(repo)).toEqual([]);
  },
);

test("review focus 5: a chat title is cut at 80 characters, from the first line that is not blank", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);

  await sessions.settled(
    (await sessions.send(repo, chat.id, { text: `   \n${"x".repeat(100)}\nmore` })).turn,
  );

  expect(cache.session(chat.id)?.title).toBe("x".repeat(80));
  await expect(sessions.send(repo, chat.id, { text: "  \n " })).rejects.toThrow(/^refused: /);
});

test("a chat renamed keeps the first line that is not blank, cut at 80 characters", async () => {
  const { cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);

  sessions.rename(repo, chat.id, `  \n ${"y".repeat(100)} \nmore`);

  expect(cache.session(chat.id)?.title).toBe("y".repeat(80));
  expect(() => sessions.rename(repo, chat.id, " \n  ")).toThrow("refused: The message is empty.");
});

test("a sub-agent's tools carry its parent", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([
    {
      id: "task-1",
      input: {},
      kind: "other",
      name: "Task",
      subagent: { description: "Map the runner code" },
      type: "toolStart",
    },
    {
      id: "read-1",
      input: {},
      kind: "read",
      name: "Read",
      parent: "task-1",
      target: "src/runner.ts",
      type: "toolStart",
    },
    { id: "read-1", isError: false, output: "x".repeat(OUTPUT_LIMIT + 10), type: "toolEnd" },
    { id: "task-1", isError: true, output: "gave up", type: "toolEnd" },
  ]);

  const { turn } = await sessions.send(repo, session.id, { text: "Map it" });
  await sessions.settled(turn);

  const [task, read] = cache.itemsOf(turn, "tool");
  expect(task).toMatchObject({
    id: "task-1",
    name: "Task",
    output: "gave up",
    status: "failed",
    subagent: { description: "Map the runner code" },
    toolKind: "other",
  });
  expect(task).not.toHaveProperty("parent");
  expect(read).toMatchObject({
    id: "read-1",
    parent: "task-1",
    status: "completed",
    target: "src/runner.ts",
    toolKind: "read",
  });
  expect(read?.output).toHaveLength(OUTPUT_LIMIT);
  expect(typeof read?.durationMs).toBe("number");
});

test("deltas update one text item until its block ends", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Say hello" });

  for (const text of ["Hel", "lo, ", "wor"]) {
    adapter.emit({ text, type: "textDelta" });
  }
  await flush();
  expect(cache.itemsOf(turn, "text")).toEqual([
    { kind: "text", seq: 1, streaming: true, text: "Hello, wor" },
  ]);

  adapter.emit({ text: "Hello, world.", type: "text" });
  adapter.emit({ text: "Bye.", type: "text" });
  adapter.emit(done());
  await sessions.settled(turn);
  expect(cache.itemsOf(turn, "text")).toEqual([
    { kind: "text", seq: 1, streaming: false, text: "Hello, world." },
    { kind: "text", seq: 2, streaming: false, text: "Bye." },
  ]);
});

test("a session of another repository is refused", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const other = fixtureRepo();
  const session = await sessions.featureSession(other, AGENT);
  await sessions.mainRoot(repo);

  await expect(sessions.send(repo, session.id, { text: "Hello" })).rejects.toThrow(
    `no session ${session.id}`,
  );
  expect(() => sessions.stop(repo, session.id)).toThrow(`no session ${session.id}`);
  expect(adapter.opens).toEqual([]);
});

/** Chat images as the server resolved them: their IDs and sizes, and their paths. */
const image = (name: string) => ({
  height: 900,
  id: `${name}.webp`,
  path: `/data/images/${name}.webp`,
  width: 1440,
});

test("US2.2: the agent receives the text, then the images' paths, and the item holds the images", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);

  const { turn } = await sessions.send(repo, chat.id, {
    images: [image("a"), image("b")],
    text: "What is wrong here?",
  });
  await sessions.settled(turn);

  expect(adapter.sent[0]).toMatchObject({
    images: [{ path: "/data/images/a.webp" }, { path: "/data/images/b.webp" }],
    text: "What is wrong here?",
    when: "queue",
  });
  expect(cache.items(turn, 0, 1)[0]).toEqual({
    at: expect.any(String),
    id: adapter.sent[0]?.id,
    images: [
      { height: 900, id: "a.webp", width: 1440 },
      { height: 900, id: "b.webp", width: 1440 },
    ],
    kind: "message",
    origin: "human",
    seq: 0,
    state: "read",
    text: "What is wrong here?",
  });
});

test("US2.2: a message without images sends none, and its item has none", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);

  const { turn } = await sessions.send(repo, chat.id, { text: "Hello" });
  await sessions.settled(turn);

  expect(adapter.sent[0]?.images).toEqual([]);
  expect(cache.items(turn, 0, 1)[0]).not.toHaveProperty("images");
});

test('US2.4: a message of an image alone is sent, and its chat is titled "Image"', async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);

  const { turn } = await sessions.send(repo, chat.id, { images: [image("a")], text: " \n" });
  await sessions.settled(turn);

  expect(adapter.sent[0]).toMatchObject({ images: [{ path: "/data/images/a.webp" }], text: "" });
  expect(cache.session(chat.id)?.title).toBe("Image");
  await expect(sessions.send(repo, chat.id, { images: [], text: "  " })).rejects.toThrow(
    "refused: The message is empty.",
  );
});

test("US2.4: an image alone on a feature goes with the opening line only", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, HUMAN);
  adapter.script([]);

  await sessions.settled(
    (await sessions.send(repo, session.id, { images: [image("a")], text: "" })).turn,
  );

  expect(adapter.sent[0]).toMatchObject({
    images: [{ path: "/data/images/a.webp" }],
    text: opening(HUMAN),
  });
});

test("US2.5: a steered message with an image, taken back, keeps its images on its item", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { images: [image("a")], text: "Look" });
  const message = adapter.sent[1]!;
  expect(message).toMatchObject({ images: [{ path: "/data/images/a.webp" }], when: "steer" });

  sessions.takeBack(repo, session.id, message.id);
  adapter.emit({ id: message.id, type: "cancelled" });
  await flush();

  expect(cache.itemsOf(turn, "message").find((each) => each.id === message.id)).toMatchObject({
    images: [{ height: 900, id: "a.webp", width: 1440 }],
    state: "taken-back",
    text: "Look",
  });
});

test("refuses an eleventh image", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const chat = await sessions.newChat(repo);
  const images = Array.from({ length: 11 }, (_, n) => image(`i${n}`));

  await expect(sessions.send(repo, chat.id, { images, text: "Many" })).rejects.toThrow(
    "refused: A message takes at most 10 images.",
  );
  expect(adapter.opens).toEqual([]);
  adapter.script([]);
  await sessions.settled(
    (await sessions.send(repo, chat.id, { images: images.slice(0, 10), text: "Ten" })).turn,
  );
  expect(adapter.sent[0]?.images).toHaveLength(10);
});

test("refuses images to an agent without them", async () => {
  const { adapter, repo, sessions } = await testSessions();
  adapter.capabilities = { ...adapter.capabilities, images: false };
  const chat = await sessions.newChat(repo);

  await expect(
    sessions.send(repo, chat.id, { images: [image("a")], text: "Look" }),
  ).rejects.toThrow("refused: This agent cannot read images.");
  expect(adapter.opens).toEqual([]);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, chat.id, { text: "Hello" })).turn);
  expect(adapter.sent).toHaveLength(1);
});

test("US2.5: a message queued while a turn runs keeps its images for its later write", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.capabilities = { ...adapter.capabilities, steer: false };
  const chat = await sessions.newChat(repo);
  const first = await sessions.send(repo, chat.id, { text: "Plan it" });

  const queued = await sessions.send(repo, chat.id, { images: [image("a")], text: "Look" });
  expect(queued.turn).not.toBe(first.turn);
  expect(cache.turn(queued.turn)?.state).toBe("queued");
  expect(adapter.sent).toHaveLength(1);
  adapter.script([]);
  adapter.emit({ id: adapter.sent[0]!.id, type: "accepted" });
  adapter.emit(done());
  await sessions.settled(queued.turn);

  expect(adapter.sent[1]).toMatchObject({
    images: [{ path: "/data/images/a.webp" }],
    text: "Look",
    when: "queue",
  });
  expect(cache.itemsOf(queued.turn, "message")[0]).toMatchObject({
    images: [{ height: 900, id: "a.webp", width: 1440 }],
    state: "read",
    text: "Look",
  });
});

test("US2.5: a queued turn's message with an image, taken back, keeps its images on its item", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  adapter.capabilities = { ...adapter.capabilities, steer: false };
  const chat = await sessions.newChat(repo);
  await sessions.send(repo, chat.id, { text: "Plan it" });
  const queued = await sessions.send(repo, chat.id, { images: [image("a")], text: "Look" });
  const [message] = cache.itemsOf(queued.turn, "message");

  sessions.takeBack(repo, chat.id, message!.id);

  expect(cache.turn(queued.turn)?.state).toBe("stopped");
  expect(cache.itemsOf(queued.turn, "message")[0]).toMatchObject({
    images: [{ height: 900, id: "a.webp", width: 1440 }],
    state: "taken-back",
    text: "Look",
  });
  expect(adapter.sent).toHaveLength(1);
});

test("a failed turn takes back an unread steered message with images, and keeps them", async () => {
  const { adapter, cache, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { images: [image("a")], text: "Look" });
  const steered = adapter.sent[1]!.id;

  adapter.emit(done({ errors: ["API error"], ok: false }));
  await sessions.settled(turn);

  expect(adapter.takenBack).toEqual([steered]);
  expect(cache.itemsOf(turn, "message").find((each) => each.id === steered)).toMatchObject({
    images: [{ height: 900, id: "a.webp", width: 1440 }],
    state: "taken-back",
    text: "Look",
  });
});

test("refuses images with a workflow message", async () => {
  const { adapter, repo, sessions } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  await expect(
    sessions.send(repo, session.id, {
      images: [image("a")],
      text: "Continue the feature.",
      workflow: { trigger: "manual" },
    }),
  ).rejects.toThrow("refused: The workflow's message takes no images.");
  expect(adapter.opens).toEqual([]);
});
