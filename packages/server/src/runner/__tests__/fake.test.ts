import { expect, test } from "vite-plus/test";
import type { AgentProcess } from "../adapter.ts";
import type { AgentEvent } from "../events.ts";
import { FakeAdapter } from "../fake.ts";

const options = { cwd: "/w", nativeId: "s1", resume: false };
const done = (): AgentEvent => ({
  type: "result",
  ok: true,
  errors: [],
  denials: [],
  interrupted: false,
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
  adapter.script([{ type: "text", text: "first" }]);
  adapter.script([{ type: "text", text: "second" }, done()]);
  const agent = adapter.open(options);

  expect(adapter.opens).toEqual([options]);
  expect(adapter.hasSession("s1")).toBe(true);
  // The process says who it is before any message.
  expect(await readUntil(agent, (event) => event.type === "init")).toEqual([
    { type: "init", sessionId: "s1", plugins: ["uraeda"], pluginErrors: [] },
  ]);

  agent.send({ id: "m1", text: "hi", when: "steer" });
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { type: "accepted", id: "m1" },
    { type: "text", text: "first" },
    done(),
  ]);

  // Nothing plays until the next message: an event emitted by the test comes first.
  adapter.emit({ type: "text", text: "between" });
  agent.send({ id: "m2", text: "again", when: "queue" });
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { type: "text", text: "between" },
    { type: "accepted", id: "m2" },
    { type: "text", text: "second" },
    done(),
  ]);
  expect(adapter.sent).toEqual([
    { id: "m1", text: "hi", when: "steer" },
    { id: "m2", text: "again", when: "queue" },
  ]);

  // A message with no script left plays nothing.
  agent.send({ id: "m3", text: "more", when: "steer" });
  adapter.exit(1, "boom");
  expect(await readUntil(agent, () => false)).toEqual([{ type: "exit", code: 1, stderr: "boom" }]);
});

test("an interrupt ends the turn as interrupted, and keeps the process", async () => {
  const adapter = new FakeAdapter();
  const agent = adapter.open(options);
  await readUntil(agent, (event) => event.type === "init");
  agent.interrupt();
  expect(await readUntil(agent, (event) => event.type === "result")).toEqual([
    { type: "result", ok: false, errors: [], denials: [], interrupted: true },
  ]);
  expect(adapter.interrupts).toBe(1);
  agent.close();
  expect(await readUntil(agent, () => false)).toEqual([{ type: "exit", code: 0, stderr: "" }]);
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
  expect(await readUntil(agent, () => false)).toEqual([{ type: "exit", code: 143, stderr: "" }]);
  expect(adapter.kills).toEqual(["SIGINT", "SIGTERM"]);
});

test("capabilities, availability, and the allow rule", async () => {
  const adapter = new FakeAdapter();
  expect(adapter.name).toBe("Claude Code");
  adapter.capabilities = { ...adapter.capabilities, steer: false, approvals: true };
  expect(adapter.capabilities).toMatchObject({ steer: false, approvals: true });
  expect(await adapter.version()).toBeDefined();
  adapter.installed = false;
  expect(await adapter.version()).toBeUndefined();
  expect(adapter.allowRule({ tool: "Bash", input: { command: "git push origin HEAD" } })).toBe(
    "Bash(git push origin HEAD)",
  );
});
