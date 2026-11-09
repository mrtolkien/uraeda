import type { RunOptions } from "uraeda-binding";
import { mergeRunOptions } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import {
  type Agents,
  isForced,
  jointCuts,
  samePick,
  sessionSpans,
  STEPS,
  type StepId,
  stepSession,
  toMap,
  toStored,
  withCut,
} from "../run-options.ts";

/** Two agents on, Claude Code first, each with its own default model. */
const DEFAULT_MODELS: Record<string, string> = { claude: "sonnet", codex: "gpt-6.1-sol" };
const AGENTS: Agents = {
  defaultModel: (runtime) => DEFAULT_MODELS[runtime],
  runtime: (chosen) => (chosen !== undefined && chosen in DEFAULT_MODELS ? chosen : "claude"),
};

const at = (step: StepId) => STEPS.indexOf(step);

test.each<{
  cut?: StepId;
  forced: ReadonlyArray<StepId>;
  name: string;
  options: RunOptions;
  spans: ReadonlyArray<[number, number]>;
}>([
  {
    forced: [],
    name: "defaults",
    options: { steps: [] },
    spans: [
      [0, 1],
      [2, 5],
    ],
  },
  {
    forced: ["spec", "plan"],
    name: "a step on another model",
    options: { steps: [{ model: "opus", step: "spec" }] },
    spans: [
      [0, 0],
      [1, 1],
      [2, 5],
    ],
  },
  {
    cut: "spec",
    forced: ["spec", "plan"],
    name: "forced",
    options: { steps: [{ model: "opus", step: "spec" }] },
    spans: [
      [0, 0],
      [1, 1],
      [2, 5],
    ],
  },
  {
    forced: [],
    name: "joined",
    options: { steps: [{ newSession: false, step: "plan" }] },
    spans: [[0, 5]],
  },
  {
    forced: [],
    name: "a default resolved",
    options: { steps: [{ agent: "claude", model: "sonnet", step: "spec" }] },
    spans: [
      [0, 1],
      [2, 5],
    ],
  },
  {
    forced: ["build", "review"],
    name: "a step on another agent",
    options: { steps: [{ agent: "codex", step: "build" }] },
    spans: [
      [0, 1],
      [2, 2],
      [3, 3],
      [4, 5],
    ],
  },
])("the joints: $name", ({ cut, forced, options, spans }) => {
  const map = toMap(options, "claude");
  const value = cut === undefined ? map : withCut(AGENTS, map, at(cut));
  expect(sessionSpans(AGENTS, value).map(({ first, last }) => [first, last])).toEqual(spans);
  // A forced joint takes no cut of the human's: none is stored.
  const defaults = toMap({ steps: [] }, "claude");
  expect(toStored(value, defaults)).toEqual(toStored(map, defaults));
  for (let index = 1; index < STEPS.length; index++) {
    const isLocked = forced.includes(STEPS[index]!);
    expect(isForced(AGENTS, value, index)).toBe(isLocked);
    if (isLocked) {
      expect(jointCuts(AGENTS, value, index)).toBe(true);
    }
  }
});

test("a pick naming the agent's default model is the same pick as none", () => {
  expect(samePick(AGENTS, { runtime: "claude" }, { model: "sonnet", runtime: "claude" })).toBe(
    true,
  );
  expect(samePick(AGENTS, { runtime: "claude" }, { model: "opus", runtime: "claude" })).toBe(false);
  expect(samePick(AGENTS, { runtime: "gone" }, { runtime: "claude" })).toBe(true);
});

test.each<{ from: StepId; options: RunOptions; same: boolean; to: StepId }>([
  { from: "discovery", options: { steps: [] }, same: true, to: "spec" },
  { from: "spec", options: { steps: [] }, same: true, to: "spec" },
  { from: "spec", options: { steps: [] }, same: false, to: "plan" },
  { from: "plan", options: { steps: [] }, same: true, to: "comments" },
  { from: "build", options: { steps: [] }, same: false, to: "plan" },
  {
    from: "discovery",
    options: { steps: [{ model: "opus", step: "spec" }] },
    same: false,
    to: "spec",
  },
  {
    from: "spec",
    options: { steps: [{ newSession: false, step: "plan" }] },
    same: true,
    to: "plan",
  },
])("$to runs in the session of $from: $same", ({ from, options, same, to }) => {
  expect(stepSession(AGENTS, toMap(options, "claude"), from, to)).toBe(same);
});

test.each<{ defaults?: RunOptions; name: string; options: RunOptions }>([
  { name: "the defaults", options: { steps: [] } },
  {
    name: "a step's model, on the first agent",
    options: { steps: [{ agent: "claude", model: "opus", step: "spec" }] },
  },
  { name: "a joint", options: { steps: [{ newSession: false, step: "plan" }] } },
  { name: "a cut", options: { steps: [{ newSession: true, step: "build" }] } },
  {
    name: "a step's agent and effort",
    options: { steps: [{ agent: "codex", effort: "high", step: "review" }] },
  },
  { name: "the implementers", options: { implementers: { agent: "codex" }, steps: [] } },
  { name: "the build's agent", options: { steps: [{ agent: "codex", step: "build" }] } },
  {
    defaults: { steps: [{ agent: "codex", step: "build" }] },
    name: "the build's agent over the settings' build",
    options: { steps: [{ agent: "claude", step: "build" }] },
  },
  {
    defaults: { steps: [{ agent: "codex", step: "build" }] },
    name: "the implementers' model over the settings' build",
    options: { implementers: { agent: "codex", model: "gpt-6-astra" }, steps: [] },
  },
  { name: "the depth", options: { reviewDepth: "branch", steps: [] } },
  {
    name: "the reviewers",
    options: {
      reviewers: [
        { agent: "codex", effort: "high", instructions: "Check the tests." },
        { command: "coderabbit review --plain" },
      ],
      steps: [],
    },
  },
])("stores only what differs: $name", ({ defaults = { steps: [] }, options }) => {
  const map = toMap(mergeRunOptions(defaults, options), "claude");
  expect(toStored(map, toMap(defaults, "claude"))).toEqual(options);
});

test("the defaults' reviewer is one agent on the review step's agent and its defaults", () => {
  const options: RunOptions = {
    steps: [{ agent: "codex", effort: "high", model: "gpt-6-astra", step: "review" }],
  };
  const map = toMap(options, "claude");
  expect(map.reviewers).toEqual([{ kind: "agent", pick: { runtime: "codex" } }]);
  expect(map.implementers).toEqual({ runtime: "claude" });
  // Left to the default, the reviewer stays unset.
  expect(toStored(map, toMap({ steps: [] }, "claude")).reviewers).toBeUndefined();
});

/**
 * The feature page saves what its map changed over the settings' map, and draws the core's merge of
 * it over the settings', which its record carries: the map it saved.
 */
test("a feature's options stored over the settings' merge back to the map they were stored from", () => {
  const settings: RunOptions = { steps: [{ effort: "high", model: "opus", step: "spec" }] };
  const defaults = toMap(settings, "claude");
  const map = withCut(
    AGENTS,
    {
      ...defaults,
      depth: "branch" as const,
      implementers: { effort: "low", runtime: "codex" },
      steps: { ...defaults.steps, build: { model: "haiku", runtime: "claude" } },
    },
    STEPS.indexOf("review"),
  );
  expect(toMap(mergeRunOptions(settings, toStored(map, defaults)), "claude")).toEqual(map);
});
