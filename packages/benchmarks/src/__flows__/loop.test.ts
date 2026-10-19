import { expect, test } from "vite-plus/test";
import type { HumanTurn } from "../loop.ts";
import { InvalidRun } from "../session.ts";
import {
  answered,
  blocked,
  fetches,
  humanSession,
  MODEL,
  result,
  runs,
  runScripted,
  UPSTREAM,
  view,
} from "./harness.ts";

const agent = (name: string, implemented = false) => view("agent", name, implemented);
const human = view("human", "human-gate");
const ok = [result()];

test("the human runs where ura says it is up, the agent otherwise, and the branch's push ends it", async () => {
  const turns: Array<HumanTurn> = [];

  const { loop } = await runScripted({
    human: async (turn) => {
      turns.push(turn);
      return answered();
    },
    pushedAfter: 2,
    turns: [ok, ok],
    views: [agent("discovery"), human, agent("final-review", true)],
  });

  expect(loop.outcome).toBe("finished");
  expect(loop.steps.map((step) => step.role)).toEqual(["agent", "human", "agent"]);
  expect(loop.steps[1]?.gate).toBe("answered");
  // The human is told where the feature's files are: the only place its commits may touch.
  expect(turns).toMatchObject([{ file: "clarifications-01.md", folder: "specs/2026-10-19-case" }]);
});

test("an implemented branch that is not pushed is not finished: the run stalls at its cap, keeping its steps", async () => {
  const { loop } = await runScripted({
    maxSteps: 3,
    turns: [ok, ok, ok],
    views: [agent("final-review", true)],
  });

  expect(loop.outcome).toBe("stalled");
  expect(loop.steps).toHaveLength(3);
});

test("a session answered by a model other than the one asked for fails the run, naming it", async () => {
  const { loop } = await runScripted({
    turns: [[result({ models: ["claude-opus-4-8"] })]],
    views: [agent("discovery")],
  });

  expect(loop.outcome).toBe("failed");
  expect(loop.reason).toContain("claude-opus-4-8");
  expect(loop.models).toEqual(["claude-opus-4-8"]);
});

/** A human turn whose session was answered by `models`. */
const turn = (models: Array<string>) => async () => ({
  commit: "c1",
  gate: "answered",
  session: humanSession({ models }),
});

test("the human's sessions are held to the human's model, not the agent's", async () => {
  const views = [human, agent("final-review", true)];

  const right = await runScripted({
    human: turn(["claude-haiku-5-5"]),
    humanModel: "claude-haiku-5-5",
    pushedAfter: 0,
    turns: [],
    views,
  });
  const wrong = await runScripted({
    human: turn([MODEL]),
    humanModel: "claude-haiku-5-5",
    turns: [],
    views,
  });

  expect(right.loop.outcome).toBe("finished");
  expect(wrong.loop).toMatchObject({ outcome: "failed", reason: expect.stringContaining(MODEL) });
});

test("a usage limit ends the run as usage-limit, not as a failure", async () => {
  const { loop } = await runScripted({
    turns: [[result({ errors: ["Claude usage limit reached"], ok: false })]],
    views: [agent("discovery")],
  });

  expect(loop.outcome).toBe("usage-limit");
});

test("a block of auto mode is allowed once with the adapter's narrow rule, and recorded", async () => {
  const { adapter, loop } = await runScripted({
    pushedAfter: 2,
    turns: [blocked("Bash", { command: "git status" }), ok],
    views: [agent("implementation"), agent("final-review", true)],
  });

  expect(loop.blocked).toEqual([{ rule: "Bash(git status)", target: "git status", tool: "Bash" }]);
  expect(adapter.opens[1]).toMatchObject({ allowed: ["Bash(git status)"], resume: true });
  expect(loop.outcome).toBe("finished");
});

test("the same action blocked again fails the run", async () => {
  const block = blocked("Bash", { command: "git status" });

  const { loop } = await runScripted({ turns: [block, ok, block], views: [agent("discovery")] });

  expect(loop.outcome).toBe("failed");
  expect(loop.reason).toContain("git status");
});

test("a block no narrow rule can allow is recorded, and the run goes on without it", async () => {
  const { adapter, loop } = await runScripted({
    pushedAfter: 1,
    turns: [blocked("Bash", { command: "rm -rf *" })],
    views: [agent("implementation"), agent("final-review", true)],
  });

  expect(loop.blocked).toMatchObject([{ rule: "none", tool: "Bash" }]);
  expect(adapter.opens).toHaveLength(1);
  expect(loop.outcome).toBe("finished");
});

test.each([
  ["the web tool on the upstream's page", fetches(`${UPSTREAM}/pull/1`), true, true],
  ["a command that fetches from the upstream", runs(`curl ${UPSTREAM}/issues/9`), true, true],
  ["the benchmark's own dataset", fetches("https://huggingface.co/datasets/ScaleAI/x"), true, true],
  ["a page elsewhere", fetches("https://docs.python.org/3/"), false, true],
  ["a repository named like the upstream's start", fetches(`${UPSTREAM}-lint`), false, true],
  ["a command that only mentions the upstream", runs(`echo ${UPSTREAM} > notes`), false, false],
])("fetching: %s", async (_, turn, flagged, recorded) => {
  const { loop } = await runScripted({ maxSteps: 1, turns: [turn], views: [agent("discovery")] });

  expect(loop.flags).toEqual(flagged ? ["leak-suspected"] : []);
  expect(loop.urls.length > 0).toBe(recorded);
});

test("a human turn that makes no commit fails the run, instead of asking the gate again", async () => {
  const { loop } = await runScripted({
    human: async () => ({ gate: "no action", session: humanSession() }),
    turns: [],
    views: [human],
  });

  expect(loop.outcome).toBe("failed");
  expect(loop.steps).toHaveLength(1);
});

test("a turn that broke the benchmark's rules ends the run as invalid, keeping the human's session", async () => {
  const { loop } = await runScripted({
    human: async () => {
      throw new InvalidRun("touched a file outside the feature", humanSession());
    },
    turns: [],
    views: [human],
  });

  expect(loop.outcome).toBe("invalid");
  expect(loop.steps).toMatchObject([{ gate: "invalid", role: "human" }]);
});

test("an error in a step ends the run as failed, with the steps before it", async () => {
  const { loop } = await runScripted({
    nextThrowsAt: 2,
    turns: [ok],
    views: [agent("discovery")],
  });

  expect(loop.outcome).toBe("failed");
  expect(loop.reason).toContain("ura exploded");
  expect(loop.steps).toHaveLength(1);
});
