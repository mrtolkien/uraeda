// Claude Code through the real adapter, against its recorded output: the agents decision's rule
// that sessions, turns, and items are one agent-neutral shape, whatever the agent writes, and that
// a message reaches the agent as the agent reads it. The command is a stand-in that replays the
// recording; `fixtures/claude/` holds what Claude Code printed.
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture, temporaryFolder } from "uraeda-binding/test-utils";
import { ClaudeAdapter } from "../runner/claude.ts";
import type { AgentEvent } from "../runner/events.ts";

/** A stand-in for `claude`, a shell script, in a folder of its own. */
function standIn(body: string) {
  const dir = temporaryFolder("uraeda-claude");
  const command = join(dir, "claude");
  writeFileSync(command, `#!/bin/sh\n${body}\n`);
  chmodSync(command, 0o755);
  return { command, dir };
}

/** A chat images folder in a temporary data folder: the adapter makes it as a process opens. */
const imagesFolder = () => join(temporaryFolder("uraeda-data"), "images");

/** A process of the adapter on the stand-in, in the folder `dir`. */
function opened(command: string, dir: string) {
  const adapter = new ClaudeAdapter({
    command,
    imagesDir: imagesFolder(),
    pluginDir: "/plugin",
  });
  return adapter.open({ cwd: dir, nativeId: "native-1", resume: false });
}

async function collect(events: AsyncIterable<AgentEvent>) {
  const all: Array<AgentEvent> = [];
  for await (const event of events) {
    all.push(event);
  }
  return all;
}

/** The events Claude Code's recorded output becomes, with its exit last. */
async function played(...recordings: Array<string>) {
  const { command, dir } = standIn(
    recordings.map((name) => `cat "${fixture(`claude/${name}`)}"`).join("\n"),
  );
  return collect(opened(command, dir).events);
}

const only = <T extends AgentEvent["type"]>(events: Array<AgentEvent>, type: T) =>
  events.filter((event): event is Extract<AgentEvent, { type: T }> => event.type === type);

test("a recorded turn becomes neutral events: tools with their kind, their end, text, a result", async () => {
  const events = await played("init.jsonl", "tool.jsonl", "text.jsonl", "result-success.jsonl");

  const [start] = only(events, "toolStart");
  const [end] = only(events, "toolEnd");
  expect(start).toMatchObject({ kind: expect.any(String), name: expect.any(String) });
  expect(end).toMatchObject({ id: start!.id, isError: expect.any(Boolean) });
  expect(only(events, "text").length).toBeGreaterThan(0);
  expect(only(events, "result")[0]).toMatchObject({ interrupted: false, ok: true });
  expect(events.at(-1)).toMatchObject({ code: 0, type: "exit" });
  // Whatever Claude Code printed, nothing of its own format is left in an event.
  for (const event of events) {
    expect(Object.keys(event)).not.toContain("message");
    expect(Object.keys(event)).not.toContain("raw");
  }
});

test("a refused action is a denial the human may allow by the narrowest rule, and an error is not ok", async () => {
  const [denied] = only(await played("result-denied.jsonl"), "result");
  const [failed] = only(await played("result-error.jsonl"), "result");

  expect(denied!.denials.length).toBeGreaterThan(0);
  const adapter = new ClaudeAdapter({ imagesDir: imagesFolder(), pluginDir: "/plugin" });
  for (const denial of denied!.denials) {
    const rule = adapter.allowRule(denial);
    // A rule names the tool and its own target: never the whole tool, which would allow any call.
    expect(rule === undefined || /^\w+\(.+\)$/.test(rule)).toBe(true);
  }
  expect(failed!.ok).toBe(false);
});

test("a line that is not JSON, or not a known event, is skipped and the turn goes on", async () => {
  const events = await played("init.jsonl", "unknown.jsonl", "result-success.jsonl");

  expect(only(events, "result")).toHaveLength(1);
  expect(events.at(-1)?.type).toBe("exit");
});

test("a missing command ends the process as missing, never as a crash of the server", async () => {
  const adapter = new ClaudeAdapter({
    command: "/nonexistent/claude",
    imagesDir: imagesFolder(),
    pluginDir: "/plugin",
  });
  const agent = adapter.open({
    cwd: temporaryFolder("uraeda-claude"),
    nativeId: "n",
    resume: false,
  });

  const events = await collect(agent.events);

  expect(events.at(-1)).toMatchObject({ missing: true, type: "exit" });
  expect(await adapter.version()).toBeUndefined();
});

test("a message reaches the agent as the user's, steered or queued, with its images, and can be taken back", async () => {
  const log = temporaryFolder("uraeda-stdin");
  const written = join(log, "stdin");
  const { command, dir } = standIn(`cat > "${written}"`);
  const agent = opened(command, dir);

  agent.send({ id: "m1", images: [{ path: "/data/images/a.webp" }], text: "Look", when: "steer" });
  agent.send({ id: "m2", images: [], text: "Then this", when: "queue" });
  agent.takeBack("m2");
  agent.close();
  await collect(agent.events);

  const lines = readFileSync(written, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { message?: { content: unknown }; priority?: string });
  const [steer, queue, takeBack] = lines;
  expect(steer).toMatchObject({ message: { role: "user" }, type: "user", uuid: "m1" });
  expect(JSON.stringify(steer?.message?.content)).toContain("/data/images/a.webp");
  expect(steer!.priority).not.toBe(queue!.priority);
  expect(takeBack).toMatchObject({ request: { message_uuid: "m2" }, type: "control_request" });
});
