import { expect, test } from "vite-plus/test";
import type { AgentProcess } from "../adapter.ts";
import type { AgentEvent } from "../events.ts";
import { FakeAdapter } from "../fake.ts";
import { flush } from "./helpers.ts";

const options = { cwd: "/w", nativeId: "s1", resume: false };
const done = (): AgentEvent => ({
  denials: [],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result",
});

/** Reads the process's events until `stop` matches one, or it exits. */
async function readUntil(
  agent: AgentProcess,
  stop: (event: AgentEvent) => boolean,
): Promise<Array<AgentEvent>> {
  const events: Array<AgentEvent> = [];
  const iterator = agent.events[Symbol.asyncIterator]();
  for (;;) {
    const next = await iterator.next();
    if (next.done) {
      return events;
    }
    events.push(next.value);
    if (stop(next.value)) {
      return events;
    }
  }
}

test("a scripted turn plays when a message is sent, then waits for the next", async () => {
  const adapter = new FakeAdapter();
  adapter.script([{ text: "first", type: "text" }]);
  adapter.script([{ text: "second", type: "text" }, done()]);
  const agent = adapter.open(options);

  expect(adapter.opens).toEqual([options]);
  expect(adapter.hasSession("s1")).toBe(true);
  // The process says who it is before any message.
  expect(await readUntil(agent, (event) => event.type === "init")).toEqual([
    { pluginErrors: [], plugins: ["uraeda"], sessionId: "s1", type: "init" },
  ]);

  agent.send({ id: "m1", images: [], text: "hi", when: "steer" });
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { id: "m1", type: "accepted" },
    { text: "first", type: "text" },
    done(),
  ]);

  // Nothing plays until the next message: an event emitted by the test comes first.
  adapter.emit({ text: "between", type: "text" });
  agent.send({ id: "m2", images: [], text: "again", when: "queue" });
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { text: "between", type: "text" },
    { id: "m2", type: "accepted" },
    { text: "second", type: "text" },
    done(),
  ]);
  expect(adapter.sent).toEqual([
    { id: "m1", images: [], text: "hi", when: "steer" },
    { id: "m2", images: [], text: "again", when: "queue" },
  ]);

  // A message with no script left plays nothing.
  agent.send({ id: "m3", images: [], text: "more", when: "steer" });
  adapter.exit(1, "boom");
  expect(await readUntil(agent, () => false)).toEqual([{ code: 1, stderr: "boom", type: "exit" }]);
});

test("an interrupt ends the turn as interrupted, and keeps the process", async () => {
  const adapter = new FakeAdapter();
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.interrupt();
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { denials: [], errors: [], interrupted: true, ok: false, type: "result" },
  ]);
  expect(adapter.interrupts).toBe(1);
  agent.close();
  expect(await readUntil(agent, () => false)).toEqual([{ code: 0, stderr: "", type: "exit" }]);
  expect(adapter.closes).toBe(1);
});

test("a stuck process ignores the interrupt and SIGINT, and ends on SIGTERM", async () => {
  const adapter = new FakeAdapter();
  adapter.ignoreInterrupt = true;
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.interrupt();
  agent.kill("SIGINT");
  agent.kill("SIGTERM");
  expect(await readUntil(agent, () => false)).toEqual([{ code: 143, stderr: "", type: "exit" }]);
  expect(adapter.kills).toEqual(["SIGINT", "SIGTERM"]);
});

test("capabilities, availability, and the allow rule", async () => {
  const adapter = new FakeAdapter();
  expect(adapter.name).toBe("Claude Code");
  adapter.capabilities = { ...adapter.capabilities, approvals: true, steer: false };
  expect(adapter.capabilities).toMatchObject({ approvals: true, steer: false });
  expect(await adapter.version()).toBeDefined();
  adapter.installed = false;
  expect(await adapter.version()).toBeUndefined();
  expect(adapter.allowRule({ input: { command: "git push origin HEAD" }, tool: "Bash" })).toBe(
    "Bash(git push origin HEAD)",
  );
});

test("a message with no scripted turn plays the fallback, and a scripted turn comes first", async () => {
  const adapter = new FakeAdapter();
  adapter.fallback = () => [{ text: "canned", type: "text" }];
  adapter.script([{ text: "scripted", type: "text" }]);
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");

  agent.send({ id: "m1", images: [], text: "hi", when: "steer" });
  agent.send({ id: "m2", images: [], text: "hello", when: "queue" });

  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { id: "m1", type: "accepted" },
    { text: "scripted", type: "text" },
    done(),
  ]);
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { id: "m2", type: "accepted" },
    { text: "canned", type: "text" },
    done(),
  ]);
});

test("an awaited step holds the next until it resolves", async () => {
  const adapter = new FakeAdapter();
  const gate = Promise.withResolvers<void>();
  const cwds: Array<string> = [];
  adapter.script([
    (cwd) => {
      cwds.push(cwd);
      return gate.promise;
    },
    { text: "after", type: "text" },
  ]);
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.send({ id: "m1", images: [], text: "go", when: "steer" });
  await readUntil(agent, (event) => event.type === "accepted");

  // The read after the step waits on its promise: nothing comes while it is pending.
  let read = false;
  const after = readUntil(agent, (event) => event.type === "result").finally(() => (read = true));
  await flush();
  expect(cwds).toEqual(["/w"]);
  expect(read).toBe(false);

  gate.resolve();
  expect(await after).toEqual([{ text: "after", type: "text" }, done()]);
});

test("an awaited step that never settles ends on the interrupt, and its process on SIGKILL", async () => {
  const adapter = new FakeAdapter();
  const signals: Array<AbortSignal> = [];
  const never = (_cwd: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<void>(() => {});
  };
  adapter.script([never, { text: "never read", type: "text" }]);
  adapter.script([never, { text: "never read", type: "text" }]);
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");

  agent.send({ id: "m1", images: [], text: "go", when: "steer" });
  await readUntil(agent, (event) => event.type === "accepted");
  const interrupted = readUntil(agent, (event) => event.type === "result");
  await flush();
  agent.interrupt();
  expect(await interrupted).toEqual([
    { denials: [], errors: [], interrupted: true, ok: false, type: "result" },
  ]);
  // The step is told, so a wait of its own can stop.
  expect(signals[0]?.aborted).toBe(true);

  agent.send({ id: "m2", images: [], text: "again", when: "steer" });
  await readUntil(agent, (event) => event.type === "accepted");
  const exited = readUntil(agent, () => false);
  await flush();
  agent.kill("SIGKILL");
  expect(await exited).toEqual([{ code: 137, stderr: "", type: "exit" }]);
  expect(signals[1]?.aborted).toBe(true);
});

test("an awaited step that never settles ends on the close, which keeps the events left", async () => {
  const adapter = new FakeAdapter();
  adapter.script([
    () => new Promise<void>(() => {}),
    { text: "flushed", type: "text" },
    () => new Promise<void>(() => {}),
  ]);
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.send({ id: "m1", images: [], text: "go", when: "steer" });
  await readUntil(agent, (event) => event.type === "accepted");
  const exited = readUntil(agent, () => false);
  await flush();
  agent.close();
  expect(await exited).toEqual([
    { text: "flushed", type: "text" },
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
    { code: 0, stderr: "", type: "exit" },
  ]);
});

test("a stuck process's awaited step holds through the interrupt, and ends on SIGTERM", async () => {
  const adapter = new FakeAdapter();
  adapter.ignoreInterrupt = true;
  adapter.script([() => new Promise<void>(() => {}), { text: "never read", type: "text" }]);
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.send({ id: "m1", images: [], text: "go", when: "steer" });
  await readUntil(agent, (event) => event.type === "accepted");
  let read = false;
  const exited = readUntil(agent, () => false).finally(() => (read = true));
  agent.interrupt();
  agent.kill("SIGINT");
  await flush();
  expect(read).toBe(false);
  agent.kill("SIGTERM");
  expect(await exited).toEqual([{ code: 143, stderr: "", type: "exit" }]);
});

test("a step that throws ends the process with its error", async () => {
  const adapter = new FakeAdapter();
  adapter.script([
    () => Promise.reject(new Error("no such file")),
    { text: "never read", type: "text" },
  ]);
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.send({ id: "m1", images: [], text: "go", when: "steer" });
  expect(await readUntil(agent, () => false)).toEqual([
    { id: "m1", type: "accepted" },
    { code: 1, stderr: "Error: no such file", type: "exit" },
  ]);
});

test("a message sent after the exit plays no fallback", () => {
  const adapter = new FakeAdapter();
  let played = 0;
  adapter.fallback = () => {
    played++;
    return [];
  };
  const agent = adapter.open(options);
  agent.close();
  agent.send({ id: "m1", images: [], text: "late", when: "steer" });
  expect(played).toBe(0);
});
