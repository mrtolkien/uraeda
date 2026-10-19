// The runner, on the fake adapter: the agents decision's rules on one session per feature, the
// agent-neutral shape of sessions, turns, and items, and the least permission. The stack decision's
// rule that the server stops what it runs is the preview flow's.
import { chmodSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { layout } from "../paths.ts";
import { SessionCache } from "../runner/cache.ts";
import { ClaudeAdapter } from "../runner/claude.ts";
import type { AgentEvent } from "../runner/events.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { startSessions } from "../server.ts";
import { byId, type Data, mutate, testServer } from "../__tests__/helpers.ts";

/** Waits on an agent, at its plan. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

type Server = Awaited<ReturnType<typeof testServer>>;

const result = (extra: Partial<Extract<AgentEvent, { type: "result" }>> = {}): AgentEvent => ({
  denials: [],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result",
  ...extra,
});

/** Sends a message through `session.send`, and returns the session it went to. */
async function send(server: Server, input: Record<string, unknown>) {
  const sent = await mutate(server.app, "session.send", input, ["id", "turns"]);
  expect(sent.error).toBeUndefined();
  return sent.data as { id: string; turns: Array<string> };
}

/** Waits for the session's latest turn to end. */
const settle = (server: Server, session: { turns: Array<string> }) =>
  server.sessions.settled(Number(session.turns.at(-1)));

/** A turn's items, read through the protocol. */
async function items(server: Server, turn: string): Promise<Array<Data>> {
  return (await byId(server.app, "TurnLog", [`${turn}:0`], ["id", "items"]))[0]?.items;
}

test("a feature has one session, in its worktree, where a chat and a workflow run follow", async () => {
  const server = await testServer();
  server.adapter.script([]);
  server.adapter.script([]);

  const chat = await send(server, { folder: AGENT, text: "What does the plan need?" });
  await settle(server, chat);
  const run = await send(server, {
    folder: AGENT,
    text: "/uraeda Continue.",
    workflow: { trigger: "manual" },
  });
  await settle(server, run);

  expect(run.id).toBe(chat.id);
  const [feature] = await byId(server.app, "Feature", [AGENT], ["id", "session"]);
  expect(feature.session).toBe(chat.id);
  const turns = await byId(server.app, "Turn", run.turns, ["id", "kind", "state"]);
  expect(turns.map((turn) => [turn.kind, turn.state])).toEqual([
    ["chat", "done"],
    ["workflow", "done"],
  ]);
  // Every process of the feature ran in its worktree, never in the main checkout.
  for (const { cwd } of server.adapter.opens) {
    expect(cwd).toBe(join(server.repo, ".worktrees", AGENT));
  }
  // Another feature has a session of its own.
  const other = await send(server, { folder: HUMAN, text: "Why A?" });
  expect(other.id).not.toBe(chat.id);
});

test("a chat is acted on only when asked: nothing starts a workflow turn by itself", async () => {
  const server = await testServer();
  server.adapter.script([]);

  const chat = await send(server, { folder: HUMAN, text: "Why did you recommend A?" });
  await settle(server, chat);

  const turns = await byId(server.app, "Turn", chat.turns, ["id", "kind"]);
  expect(turns.map((turn) => turn.kind)).toEqual(["chat"]);
  expect(server.adapter.sent).toHaveLength(1);
});

test("a turn reads back as messages, tools, and text, whatever agent ran it", async () => {
  const server = await testServer();
  server.adapter.script([
    {
      id: "tool-1",
      input: { command: "ls" },
      kind: "execute",
      name: "Bash",
      target: "ls",
      type: "toolStart",
    },
    { id: "tool-1", isError: false, output: "plan.md", type: "toolEnd" },
    { text: "The plan is short.", type: "text" },
  ]);

  const session = await send(server, { folder: AGENT, text: "Look around" });
  await settle(server, session);

  const log = await items(server, session.turns[0]!);
  expect(log.map((item) => item.kind)).toEqual(["message", "tool", "text"]);
  expect(log[0]).toMatchObject({ origin: "human", text: "Look around" });
  expect(log[1]).toMatchObject({ name: "Bash", status: "completed", toolKind: "execute" });
  expect(log[2].text).toBe("The plan is short.");
  // Nothing of the agent's own format is kept: an item carries only the neutral fields.
  for (const item of log) {
    expect(Object.keys(item).sort()).not.toContain("raw");
  }
});

test("a session of another repository is not read, nor written", async () => {
  const server = await testServer();
  const { cache } = server.sessions;
  const row = cache.createSession({
    agent: "fake",
    folder: AGENT,
    nativeId: "3f2c",
    repo: "/elsewhere/repo",
    title: null,
  });

  expect(await byId(server.app, "Session", [row.id], ["id"])).toEqual([]);
  for (const [name, input] of [
    ["session.send", { session: row.id, text: "Hello" }],
    ["session.stop", { session: row.id }],
  ] as const) {
    expect((await mutate(server.app, name, input, ["id"])).error).toBeDefined();
  }
  expect(server.adapter.opens).toHaveLength(0);
});

test("a feature's files are refused writes while its turn runs, and other work stays open", async () => {
  const server = await testServer();
  const running = await send(server, { folder: HUMAN, text: "Why A?" });
  const answer = () =>
    mutate(
      server.app,
      "answer.save",
      { comment: "", folder: HUMAN, letters: ["A"], previous: "", question: "Q1" },
      ["id"],
    );
  const [priorities] = await byId(server.app, "Priorities", ["priorities"], ["id", "hash"]);

  expect((await answer()).ok).toBe(false);
  // The priorities are no feature's files: they stay writable.
  const added = await mutate(
    server.app,
    "priorities.add",
    { hash: priorities.hash, section: "next", text: "Show the agent's last commit" },
    ["id"],
  );
  expect(added.ok).toBe(true);

  await server.sessions.mainRoot(server.repo);
  expect((await mutate(server.app, "session.stop", { session: running.id }, ["id"])).ok).toBe(true);
  await settle(server, running);
  expect((await answer()).ok).toBe(true);
});

test("stopping a turn interrupts the agent and keeps the session", async () => {
  const server = await testServer();
  const session = await send(server, { folder: AGENT, text: "Plan it" });

  await mutate(server.app, "session.stop", { session: session.id }, ["id"]);
  await settle(server, session);

  expect(server.adapter.interrupts).toBeGreaterThan(0);
  const [turn] = await byId(server.app, "Turn", session.turns, ["id", "state"]);
  expect(turn.state).toBe("stopped");
  const [record] = await byId(server.app, "Session", [session.id], ["id", "archived"]);
  expect(record).toBeDefined();
});

test("a refused action is shown, and allowed only by the human, for that process alone", async () => {
  const server = await testServer();
  server.adapter.script([
    result({ denials: [{ input: { command: "git push origin HEAD" }, tool: "Bash" }] }),
  ]);
  const session = await send(server, { folder: AGENT, text: "Push it" });
  await settle(server, session);

  const [blocked] = await byId(server.app, "Session", [session.id], ["status", "statusReason"]);
  expect(blocked).toMatchObject({ status: "needs-you", statusReason: "blocked" });
  expect(server.adapter.opens.at(-1)?.allowed).toBeUndefined();

  // Nothing allows it without the human: the next message opens no wider process.
  const denial = (await items(server, session.turns[0]!)).find((item) => item.kind === "denial");
  server.adapter.script([]);
  const allowed = await mutate(
    server.app,
    "session.allow",
    { seq: denial.seq, session: session.id, turn: session.turns[0] },
    ["id", "turns"],
  );
  await server.sessions.settled(Number(allowed.data.turns.at(-1)));

  expect(server.adapter.opens.at(-1)?.allowed).toEqual(["Bash(git push origin HEAD)"]);
  const [turn] = await byId(server.app, "Turn", [allowed.data.turns.at(-1)], ["id", "kind"]);
  expect(turn.kind).toBe("allow");
});

test("an action no rule covers alone cannot be allowed", async () => {
  const server = await testServer();
  server.adapter.script([
    result({ denials: [{ input: { command: "rm -rf build/*" }, tool: "Bash" }] }),
  ]);
  const session = await send(server, { folder: AGENT, text: "Clean up" });
  await settle(server, session);
  const denial = (await items(server, session.turns[0]!)).find((item) => item.kind === "denial");

  const refused = await mutate(
    server.app,
    "session.allow",
    { seq: denial.seq, session: session.id, turn: session.turns[0] },
    ["id"],
  );

  expect(refused.ok).toBe(false);
  expect(server.adapter.opens.at(-1)?.allowed).toBeUndefined();
});

test("a start marks the turns a stopped server left as stopped, never as running", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const earlier = SessionCache.open(join(dataDir, "runner.sqlite"), { pid: 1 });
  const row = earlier.createSession({
    agent: "fake",
    folder: AGENT,
    nativeId: "earlier",
    repo: "/repo",
    title: null,
  });
  const turn = earlier.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: row.id,
    state: "running",
    step: null,
    trigger: null,
  });
  earlier.db.close();

  const started = await startSessions({
    adapter: new FakeAdapter(),
    binding: await import("uraeda-binding"),
    dataDir,
    hosts: () => undefined,
  });

  expect(started.sessions.cache.turn(turn)?.state).toBe("stopped");
  await started.stop();
});

/** A command standing in for `claude`, which records how it was run and speaks no more. */
function standIn() {
  const dir = temporaryFolder("uraeda-claude");
  const record = join(dir, "run.json");
  const command = join(dir, "claude");
  writeFileSync(
    command,
    `#!/bin/sh\nnode -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ args: process.argv.slice(2) }))' "${record}" "$@"\n`,
  );
  chmodSync(command, 0o755);
  return { command, record };
}

test("Claude Code runs on the user's login with the least permission that works unattended", async () => {
  const { command, record } = standIn();
  const config = temporaryFolder("uraeda-claude-config");
  writeFileSync(join(config, ".credentials.json"), '{"token":"the-users"}');
  writeFileSync(join(config, "settings.json"), '{"theme":"dark"}');
  const adapter = new ClaudeAdapter({
    command,
    configDir: config,
    imagesDir: join(temporaryFolder("uraeda-data"), "images"),
    pluginDir: layout().plugin,
  });
  const claude = adapter.open({
    allowed: ["Bash(git push origin HEAD)"],
    cwd: temporaryFolder("uraeda-worktree"),
    nativeId: "native-1",
    resume: false,
  });

  // The process ends on its own: its events end with its exit.
  for await (const event of claude.events) {
    if (event.type === "exit") {
      break;
    }
  }

  const { args } = JSON.parse(readFileSync(record, "utf8")) as { args: Array<string> };
  expect(args.join(" ")).not.toMatch(/skip-permissions|bypass/i);
  expect(args[args.indexOf("--permission-mode") + 1]).toBe("auto");
  // The rule the human allowed reaches this process, and only as a rule.
  expect(args.slice(args.indexOf("--allowedTools") + 1)).toEqual(["Bash(git push origin HEAD)"]);
  // The server's own copy of the skill, never a repository's.
  expect(args[args.indexOf("--plugin-dir") + 1]).toBe(layout().plugin);
  // The user's login and settings are as they were.
  expect(readdirSync(config).sort()).toEqual([".credentials.json", "settings.json"]);
  expect(readFileSync(join(config, ".credentials.json"), "utf8")).toBe('{"token":"the-users"}');
  expect(readFileSync(join(config, "settings.json"), "utf8")).toBe('{"theme":"dark"}');
});
