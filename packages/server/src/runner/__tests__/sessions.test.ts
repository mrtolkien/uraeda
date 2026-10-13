import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixtureRepo } from "uraeda-binding/test-utils";
import type { AgentEvent } from "../events.ts";
import { IDLE_CLOSE_MS, OUTPUT_LIMIT, TERMINATE_AFTER_MS, WATCHDOG_MS } from "../sessions.ts";
import { flush, testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

const opening = (folder: string) =>
  `A human is chatting with you about the feature specs/${folder}/, on branch ${folder}: answer, ` +
  "and change files, commit, or move the workflow only when they ask.";

const done = (extra: Partial<Extract<AgentEvent, { type: "result" }>> = {}): AgentEvent => ({
  type: "result",
  ok: true,
  errors: [],
  denials: [],
  interrupted: false,
  ...extra,
});

afterEach(() => {
  vi.useRealTimers();
});

test("US1.1: a chat message on a feature waiting on the human goes with the opening line", async () => {
  const { sessions, adapter, cache, repo, changes } = await testSessions();
  const session = await sessions.featureSession(repo, HUMAN);
  adapter.script([{ type: "text", text: "Because A keeps one process." }]);

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
      seq: 0,
      kind: "message",
      id: adapter.sent[0]?.id,
      text: "Why did you recommend A in Q6?",
      origin: "human",
      opening: opening(HUMAN),
      state: "read",
    },
    { seq: 1, kind: "text", text: "Because A keeps one process.", streaming: false },
  ]);
  expect((await binding.nextStep(repo, HUMAN)).step.waitsOn).toBe("human");
  expect(changes).toContainEqual({
    repo,
    session: session.id,
    folder: HUMAN,
    turn,
    state: "running",
  });
  expect(changes).toContainEqual({ repo, session: session.id, folder: HUMAN, turn, state: "done" });
  expect(changes).toContainEqual({ repo, session: session.id, folder: HUMAN, turn });
});

test("US1.2: a second message goes without the opening line, on the same process", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
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
  expect(message).toMatchObject({ kind: "message", text: "Second", state: "read" });
});

test("US1.3: a message sent during a turn is steered into it", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  const steered = await sessions.send(repo, session.id, { text: "Use the existing helper" });

  expect(steered.turn).toBe(turn);
  expect(adapter.sent[1]).toMatchObject({ text: "Use the existing helper", when: "steer" });
  const item = () => cache.items(turn, 0, 10).find((each) => each.seq === 1);
  expect(item()).toMatchObject({ kind: "message", state: "pending" });

  adapter.emit({ type: "accepted", id: adapter.sent[0]!.id });
  adapter.emit({ type: "accepted", id: adapter.sent[1]!.id });
  await flush();
  expect(item()).toMatchObject({ kind: "message", state: "read" });

  adapter.emit(done());
  await sessions.settled(turn);
  expect(cache.turns(session.id)).toHaveLength(1);
  expect(cache.turn(turn)?.state).toBe("done");
});

test("US1.4: a pending message can be taken back", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Never mind" });
  const message = adapter.sent[1]!.id;

  sessions.takeBack(repo, session.id, message);
  expect(adapter.takenBack).toEqual([message]);
  adapter.emit({ type: "cancelled", id: message });
  await flush();
  expect(cache.itemsOf(turn, "message").find((each) => each.id === message)?.state).toBe(
    "taken-back",
  );

  await sessions.send(repo, session.id, { text: "Use the helper" });
  const read = adapter.sent[2]!.id;
  adapter.emit({ type: "accepted", id: read });
  await flush();
  expect(() => sessions.takeBack(repo, session.id, read)).toThrow(
    "refused: The agent already read it.",
  );
  expect(adapter.takenBack).toEqual([message]);
});

test("a turn that fails takes back the message steered into it, which no turn would record", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.send(repo, session.id, { text: "Use the helper" });
  const steered = adapter.sent[1]!.id;

  adapter.emit(done({ ok: false, errors: ["API error"] }));
  await sessions.settled(turn);

  expect(cache.turn(turn)).toMatchObject({ state: "failed", reason: "API error" });
  expect(adapter.takenBack).toEqual([steered]);
  expect(cache.itemsOf(turn, "message").find((each) => each.id === steered)?.state).toBe(
    "taken-back",
  );
});

test("US1.5: Stop interrupts the turn and keeps the process", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
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
  const { sessions, adapter, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  expect(sessions.working(repo)).toEqual([AGENT]);

  adapter.emit(done());
  await sessions.settled(turn);
  expect(sessions.working(repo)).toEqual([]);
});

test("US1.7 and C1: an idle process closes after 15 minutes, and the next message resumes the same session", async () => {
  const { sessions, adapter, repo } = await testSessions();
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
  expect(adapter.opens[1]).toMatchObject({ resume: true, nativeId: adapter.opens[0]!.nativeId });
});

test("US2.2: a workflow message starts a workflow turn", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
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
    trigger: "manual",
    step: "plan",
    state: "done",
  });
  const [message] = cache.items(turn, 0, 1);
  expect(message).toMatchObject({ kind: "message", text, origin: "workflow" });
  expect(message).not.toHaveProperty("opening");
});

test("US2.4: a workflow message on a feature waiting on the human is refused", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, HUMAN);

  await expect(
    sessions.send(repo, session.id, { text: "Continue", workflow: { trigger: "manual" } }),
  ).rejects.toThrow("refused: The feature waits on you now: there is nothing to continue.");
  expect(adapter.opens).toEqual([]);
  expect(cache.turns(session.id)).toEqual([]);
});

test("US2.5: a workflow message during a chat turn is queued, and starts after it", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
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
  const { sessions, adapter, cache, repo } = await testSessions();
  const chat = await sessions.newChat(repo);
  expect(chat).toMatchObject({ repo, folder: null, title: null, agent: "fake" });
  adapter.script([]);

  const { turn } = await sessions.send(repo, chat.id, { text: "List the open draft files" });
  await sessions.settled(turn);

  expect(adapter.opens[0]?.cwd).toBe(repo);
  expect(adapter.sent[0]?.text).toBe("List the open draft files");
  expect(cache.items(turn, 0, 1)[0]).not.toHaveProperty("opening");
  expect(cache.session(chat.id)?.title).toBe("List the open draft files");
});

test("US4.3: sending to an archived chat brings it back", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
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
  const { sessions, adapter, repo } = await testSessions();
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
  const { sessions, adapter, cache, repo } = setup;
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([
    done({ denials: [{ tool: "Bash", input: { command: "git push origin HEAD" } }] }),
  ]);
  const { turn } = await sessions.send(repo, session.id, { text: "Push it" });
  await sessions.settled(turn);
  const [denial] = cache.itemsOf(turn, "denial");
  return { ...setup, session, turn, denial: denial! };
}

test("US5.2: Allow and retry reopens the process with the rule and sends the retry message", async () => {
  const { sessions, adapter, cache, repo, session, turn, denial } = await blockedPush();
  expect(denial).toMatchObject({
    tool: "Bash",
    target: "git push origin HEAD",
    rule: "Bash(git push origin HEAD)",
    allowed: false,
  });
  adapter.script([]);

  const allowed = await sessions.allow(repo, session.id, turn, denial.seq);
  await sessions.settled(allowed.turn);

  expect(adapter.closes).toBe(1);
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({
    allowed: "Bash(git push origin HEAD)",
    resume: true,
    nativeId: adapter.opens[0]!.nativeId,
  });
  expect(adapter.sent.at(-1)?.text).toBe(
    "Try the blocked action again, now allowed: Bash git push origin HEAD",
  );
  expect(cache.itemsOf(turn, "denial")[0]?.allowed).toBe(true);
  expect(cache.turn(allowed.turn)).toMatchObject({
    kind: "allow",
    allowed: "Bash(git push origin HEAD)",
    state: "done",
  });
  expect(cache.items(allowed.turn, 0, 1)[0]).toMatchObject({
    kind: "message",
    origin: "human",
    text: "Try the blocked action again, now allowed: Bash git push origin HEAD",
  });
});

test("US5.3: the rule ends with its process", async () => {
  const { sessions, adapter, repo, session, turn, denial } = await blockedPush();
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
  const { sessions, adapter, cache, repo } = await testSessions();
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
    { seq: 0, kind: "system", text: "Started a new session: the previous one is gone." },
  ]);
});

test("the process exits during a turn: it fails with its stderr", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);

  const first = await sessions.send(repo, session.id, { text: "Plan it" });
  adapter.exit(1, "starting\nout of memory\n");
  await sessions.settled(first.turn);
  expect(cache.turn(first.turn)).toMatchObject({
    state: "failed",
    reason: "starting\nout of memory",
  });

  const second = await sessions.send(repo, session.id, { text: "Again" });
  adapter.exit(2);
  await sessions.settled(second.turn);
  expect(cache.turn(second.turn)).toMatchObject({
    state: "failed",
    reason: "Claude Code exited with code 2.",
  });
});

test("the process exits between turns: the next message resumes it", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([]);
  await sessions.settled((await sessions.send(repo, session.id, { text: "Hello" })).turn);

  adapter.exit(137);
  await flush();
  adapter.script([]);
  const { turn } = await sessions.send(repo, session.id, { text: "Still there?" });
  await sessions.settled(turn);

  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({ resume: true, nativeId: adapter.opens[0]!.nativeId });
  expect(cache.turn(turn)?.state).toBe("done");
});

test("an interrupted result with no text ends the turn as stopped", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  adapter.emit(done({ ok: false, errors: ["[ede_diagnostic] aborted"], interrupted: true }));
  await sessions.settled(turn);

  expect(cache.turn(turn)).toMatchObject({ state: "stopped", reason: null });
});

test("an init with a new session ID updates the native ID", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  await sessions.send(repo, session.id, { text: "/clear" });

  adapter.emit({ type: "init", sessionId: "cleared-1", plugins: ["uraeda"], pluginErrors: [] });
  await flush();

  expect(cache.session(session.id)?.nativeId).toBe("cleared-1");
});

test("a feature with no branch refuses with 'This feature has no branch yet: commit its proposal first.'", async () => {
  const repo = fixtureRepo();
  const folder = "2026-10-20-draft";
  mkdirSync(join(repo, "specs", folder));
  writeFileSync(join(repo, "specs", folder, "proposal.md"), "# Draft\n\n## What\n\nA draft.\n");
  const { sessions, adapter } = await testSessions(repo);
  expect((await binding.nextStep(repo, folder)).branch).toBeUndefined();
  const session = await sessions.featureSession(repo, folder);

  await expect(sessions.send(repo, session.id, { text: "Hello" })).rejects.toThrow(
    "refused: This feature has no branch yet: commit its proposal first.",
  );
  expect(adapter.opens).toEqual([]);
});

test("the watchdog fails a silent turn after 30 minutes with 'No output for 30 minutes.'", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  // Output keeps it going.
  vi.advanceTimersByTime(WATCHDOG_MS - 1);
  adapter.emit({ type: "textDelta", text: "Thinking" });
  await flush();
  vi.advanceTimersByTime(WATCHDOG_MS - 1);
  expect(cache.turn(turn)?.state).toBe("running");

  vi.advanceTimersByTime(1);
  await sessions.settled(turn);
  expect(cache.turn(turn)).toMatchObject({ state: "failed", reason: "No output for 30 minutes." });
});

test("a plugin that does not load fails the turn with 'The Uraeda skill did not load: <error>'", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  adapter.autoInit = false;
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });

  adapter.emit({
    type: "init",
    sessionId: session.nativeId,
    plugins: [],
    pluginErrors: ["no manifest", "bad skill"],
  });
  await sessions.settled(turn);
  await flush();

  expect(cache.turn(turn)).toMatchObject({
    state: "failed",
    reason: "The Uraeda skill did not load: no manifest; bad skill",
  });
  expect(adapter.closes).toBe(1);
});

test("review focus 1: a message sent before the process's init is sent once", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  adapter.autoInit = false;
  const session = await sessions.featureSession(repo, AGENT);

  // Both are sent at once: the second while the first is still opening the process.
  const [first, second] = await Promise.all([
    sessions.send(repo, session.id, { text: "Plan it" }),
    sessions.send(repo, session.id, { text: "Keep it short" }),
  ]);
  adapter.emit({
    type: "init",
    sessionId: session.nativeId,
    plugins: ["uraeda"],
    pluginErrors: [],
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
  const { sessions, adapter, cache, repo } = await testSessions();
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

  expect(cache.turn(chat.turn)).toMatchObject({ state: "failed", reason: "crashed" });
  expect(cache.turn(workflow.turn)?.state).toBe("done");
  expect(adapter.opens).toHaveLength(2);
  expect(adapter.opens[1]).toMatchObject({ resume: true, nativeId: adapter.opens[0]!.nativeId });
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
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const { sessions, adapter, cache, repo } = await testSessions(undefined, {
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
  const { sessions, adapter, cache, repo } = await testSessions();
  const chat = await sessions.newChat(repo);
  adapter.script([]);

  await sessions.settled(
    (await sessions.send(repo, chat.id, { text: `   \n${"x".repeat(100)}\nmore` })).turn,
  );

  expect(cache.session(chat.id)?.title).toBe("x".repeat(80));
  await expect(sessions.send(repo, chat.id, { text: "  \n " })).rejects.toThrow(/^refused: /);
});

test("a sub-agent's tools carry its parent", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  adapter.script([
    {
      type: "toolStart",
      id: "task-1",
      name: "Task",
      kind: "other",
      input: {},
      subagent: { description: "Map the runner code" },
    },
    {
      type: "toolStart",
      id: "read-1",
      name: "Read",
      kind: "read",
      input: {},
      target: "src/runner.ts",
      parent: "task-1",
    },
    { type: "toolEnd", id: "read-1", isError: false, output: "x".repeat(OUTPUT_LIMIT + 10) },
    { type: "toolEnd", id: "task-1", isError: true, output: "gave up" },
  ]);

  const { turn } = await sessions.send(repo, session.id, { text: "Map it" });
  await sessions.settled(turn);

  const [task, read] = cache.itemsOf(turn, "tool");
  expect(task).toMatchObject({
    id: "task-1",
    name: "Task",
    toolKind: "other",
    status: "failed",
    subagent: { description: "Map the runner code" },
    output: "gave up",
  });
  expect(task).not.toHaveProperty("parent");
  expect(read).toMatchObject({
    id: "read-1",
    toolKind: "read",
    target: "src/runner.ts",
    status: "completed",
    parent: "task-1",
  });
  expect(read?.output).toHaveLength(OUTPUT_LIMIT);
  expect(typeof read?.durationMs).toBe("number");
});

test("deltas update one text item until its block ends", async () => {
  const { sessions, adapter, cache, repo } = await testSessions();
  const session = await sessions.featureSession(repo, AGENT);
  const { turn } = await sessions.send(repo, session.id, { text: "Say hello" });

  for (const text of ["Hel", "lo, ", "wor"]) {
    adapter.emit({ type: "textDelta", text });
  }
  await flush();
  expect(cache.itemsOf(turn, "text")).toEqual([
    { seq: 1, kind: "text", text: "Hello, wor", streaming: true },
  ]);

  adapter.emit({ type: "text", text: "Hello, world." });
  adapter.emit({ type: "text", text: "Bye." });
  adapter.emit(done());
  await sessions.settled(turn);
  expect(cache.itemsOf(turn, "text")).toEqual([
    { seq: 1, kind: "text", text: "Hello, world.", streaming: false },
    { seq: 2, kind: "text", text: "Bye.", streaming: false },
  ]);
});

test("a session of another repository is refused", async () => {
  const { sessions, adapter, repo } = await testSessions();
  const other = fixtureRepo();
  const session = await sessions.featureSession(other, AGENT);
  await sessions.mainRoot(repo);

  await expect(sessions.send(repo, session.id, { text: "Hello" })).rejects.toThrow(
    `no session ${session.id}`,
  );
  expect(() => sessions.stop(repo, session.id)).toThrow(`no session ${session.id}`);
  expect(adapter.opens).toEqual([]);
});
