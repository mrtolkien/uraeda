import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextJson } from "../next.ts";
import { expect, test } from "vite-plus/test";
import {
  blockedTurn,
  fetchTurn,
  humanSession,
  InvalidRun,
  result,
  runScripted,
  view,
} from "./loop-helpers.ts";

const agent = (name: string, implemented = false) => view("agent", name, { implemented });
const human = view("human", "human-gate");
const ok = [result()];

test("US1.2: the human runs at a gate and the agent only after the answers", async () => {
  const calls: Array<string> = [];

  const { loop } = await runScripted({
    human: async (_, sessions) => {
      calls.push(`human after ${sessions} agent sessions`);
      return { commit: "c1", gate: "answered", session: humanSession() };
    },
    pushedAfter: 2,
    turns: [ok, ok],
    views: [agent("discovery"), human, agent("spec", true)],
  });

  expect(loop.steps.map((step) => step.role)).toEqual(["agent", "human", "agent"]);
  expect(calls).toEqual(["human after 1 agent sessions"]);
  expect(loop.steps[1]?.gate).toBe("answered");
});

test("US1.3: 30 sessions end the run as stalled and keep the steps", async () => {
  const { loop } = await runScripted({
    maxSteps: 30,
    turns: Array.from({ length: 30 }, () => ok),
    views: [agent("discovery")],
  });

  expect(loop.outcome).toBe("stalled");
  expect(loop.steps).toHaveLength(30);
});

test("the run ends finished once the branch is pushed after the implementation", async () => {
  const { loop } = await runScripted({
    pushedAfter: 2,
    turns: [ok, ok],
    views: [agent("implementation"), agent("final-review", true), agent("final-review", true)],
  });

  expect(loop.outcome).toBe("finished");
  expect(loop.steps).toHaveLength(2);
});

test("a branch that is not pushed is not finished, however implemented", async () => {
  const { loop } = await runScripted({
    maxSteps: 3,
    turns: [ok, ok, ok],
    views: [agent("final-review", true)],
  });

  expect(loop.outcome).toBe("stalled");
});

test("a result naming another model fails the run, naming it", async () => {
  const { loop } = await runScripted({
    turns: [[result({ models: ["claude-opus-4-8"] })]],
    views: [agent("discovery")],
  });

  expect(loop).toMatchObject({
    outcome: "failed",
    reason: expect.stringContaining("claude-opus-4-8"),
  });
});

test("a usage limit ends the run as usage-limit", async () => {
  const { loop } = await runScripted({
    turns: [[result({ errors: ["Claude usage limit reached"], ok: false })]],
    views: [agent("discovery")],
  });

  expect(loop.outcome).toBe("usage-limit");
});

test("an auto block is allowed once with the adapter's rule, and recorded", async () => {
  const { adapter, loop } = await runScripted({
    pushedAfter: 2,
    turns: [blockedTurn("npm test"), ok],
    views: [agent("implementation"), agent("final-review", true)],
  });

  expect(adapter.opens[1]).toMatchObject({ allowed: "Bash(npm test)", resume: true });
  expect(loop.blocked).toEqual([{ rule: "Bash(npm test)", target: "npm test", tool: "Bash" }]);
});

test("the same block twice fails the run", async () => {
  const { loop } = await runScripted({
    turns: [blockedTurn("npm test"), ok, blockedTurn("npm test")],
    views: [agent("implementation")],
  });

  expect(loop).toMatchObject({ outcome: "failed", reason: expect.stringContaining("again") });
});

test("a fetched address of the upstream flags the run leak-suspected, and is recorded", async () => {
  const { loop } = await runScripted({
    pushedAfter: 1,
    turns: [fetchTurn("https://github.com/ansible/ansible/pull/1")],
    views: [agent("discovery"), agent("discovery", true)],
  });

  expect(loop.flags).toEqual(["leak-suspected"]);
  expect(loop.urls).toEqual(["https://github.com/ansible/ansible/pull/1"]);
});

test("an address outside the upstream does not flag the run", async () => {
  const { loop } = await runScripted({
    pushedAfter: 1,
    turns: [fetchTurn("https://docs.python.org/3/")],
    views: [agent("discovery"), agent("discovery", true)],
  });

  expect(loop.flags).toEqual([]);
});

test("a late new round is answered like the first, within the cap", async () => {
  const { loop } = await runScripted({
    pushedAfter: 3,
    turns: [ok, ok, ok],
    views: [
      agent("discovery"),
      human,
      agent("implementation"),
      human,
      agent("implementation", true),
    ],
  });

  expect(loop.steps.map((step) => step.role)).toEqual([
    "agent",
    "human",
    "agent",
    "human",
    "agent",
  ]);
  expect(loop.outcome).toBe("finished");
});

test("a human's invalid turn ends the run as invalid", async () => {
  const { loop } = await runScripted({
    human: async () => {
      throw new InvalidRun("the human's commit touched src/app.py");
    },
    turns: [ok],
    views: [agent("discovery"), human],
  });

  expect(loop).toMatchObject({
    outcome: "invalid",
    reason: "the human's commit touched src/app.py",
  });
});

test("the step ura names once every task is checked, with no pull request host, is finished when pushed", async () => {
  const after: NextJson = JSON.parse(
    readFileSync(join(import.meta.dirname, "fixtures/next-after-push.json"), "utf8"),
  );

  const { loop } = await runScripted({
    pushedAfter: 1,
    turns: [ok],
    views: [agent("implementation"), after],
  });

  expect(after.step).toMatchObject({
    implemented: true,
    name: "final-review",
    "waits-on": "agent",
  });
  expect(loop.outcome).toBe("finished");
});

test("a human turn that makes no commit fails the run instead of repeating the gate", async () => {
  const { loop } = await runScripted({
    human: async () => ({ gate: "no action", session: humanSession() }),
    turns: [ok],
    views: [agent("discovery"), human],
  });

  expect(loop).toMatchObject({ outcome: "failed", reason: expect.stringContaining("no commit") });
});
