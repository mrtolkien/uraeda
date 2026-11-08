import { expect, test } from "vite-plus/test";
import type { ModelList } from "../adapter.ts";
import { FakeAdapter } from "../fake.ts";
import { checkEffort, newSessionPick, type Picked, pickOf, type SessionPick } from "../picks.ts";
import { Runtimes } from "../runtimes.ts";

const REPO = "/repo";

const efforts = (...ids: Array<string>) => ids.map((id) => ({ id, name: id }));

const CLAUDE: ModelList = {
  defaults: { effort: "high", model: "opus" },
  models: [
    { efforts: efforts("low", "medium", "high", "max"), id: "opus", name: "Opus" },
    { efforts: [], id: "haiku", name: "Haiku 4.5" },
  ],
};

const CODEX: ModelList = {
  defaults: { effort: "medium", model: "gpt-6.1-sol" },
  models: [
    {
      efforts: efforts("low", "medium", "high", "xhigh", "max", "ultra"),
      id: "gpt-6.1-sol",
      name: "GPT-6.1-Sol",
    },
    { efforts: efforts("low", "medium", "high"), id: "gpt-6-astra", name: "GPT-6-Astra" },
    {
      efforts: efforts("low", "medium", "high", "xhigh", "max"),
      id: "gpt-6-luna",
      name: "GPT-6-Luna",
    },
  ],
};

/** A fake runtime named `name` for people, listing `list`, or failing to list without one. */
function adapter(name: string, list?: ModelList): FakeAdapter {
  const fake = new FakeAdapter();
  fake.name = name;
  if (list) {
    fake.modelList = list;
  } else {
    fake.modelsFail = true;
  }
  return fake;
}

/** `claude`, `codex`, and `pi`, whose list cannot be read, each listed once. */
async function lists(): Promise<Runtimes> {
  const runtimes = new Runtimes();
  runtimes.register("claude", adapter("Claude Code", CLAUDE));
  runtimes.register("codex", adapter("Codex", CODEX));
  runtimes.register("pi", adapter("pi"));
  await runtimes.refreshModels();
  return runtimes;
}

test.each<[string, SessionPick, Picked | string]>([
  [
    "nothing picked: the first on, the agent's defaults",
    {},
    { agent: "claude", effort: null, model: null },
  ],
  [
    "a model and its effort",
    { effort: "high", model: "gpt-6-astra", runtime: "codex" },
    { agent: "codex", effort: "high", model: "gpt-6-astra" },
  ],
  [
    "a model the list lacks",
    { model: "gpt-6-astra", runtime: "claude" },
    "Claude Code has no model gpt-6-astra: pick another",
  ],
  [
    "another agent's model",
    { model: "opus", runtime: "codex" },
    "Codex has no model opus: pick another",
  ],
  [
    "an effort the model does not take",
    { effort: "ultra", model: "gpt-6-luna", runtime: "codex" },
    "GPT-6-Luna takes no Ultra effort: pick another",
  ],
  [
    "an effort on the default model, which takes it",
    { effort: "max", runtime: "codex" },
    { agent: "codex", effort: "max", model: null },
  ],
  [
    "an effort the default model does not take",
    { effort: "ultra", runtime: "claude" },
    "Opus takes no Ultra effort: pick another",
  ],
  [
    "an effort on a model that takes none",
    { effort: "low", model: "haiku", runtime: "claude" },
    "Haiku 4.5 takes no Low effort: pick another",
  ],
  ["a model with no list yet", { model: "x", runtime: "pi" }, "pi has no model x: pick another"],
  [
    "an agent off, before its model",
    { model: "opus", runtime: "gone" },
    "gone is off: turn it on to continue this session",
  ],
])("%s", async (_, pick, expected) => {
  const runtimes = await lists();
  const run = () => newSessionPick(runtimes, REPO, pick);
  if (typeof expected === "string") {
    expect(run).toThrow(`refused: ${expected}`);
  } else {
    expect(run()).toEqual(expected);
  }
});

test.each<[string, string, string | null, string | null, string | undefined]>([
  ["the default effort", "codex", "gpt-6-luna", null, undefined],
  ["an effort the model takes", "codex", "gpt-6-luna", "max", undefined],
  ["an effort the model does not", "codex", "gpt-6-luna", "ultra", "GPT-6-Luna takes no Ultra"],
  ["the default model's effort", "codex", null, "ultra", undefined],
  ["the default model, refusing", "claude", null, "xhigh", "Opus takes no Extra high effort"],
  ["a model the list no longer holds: the agent answers", "codex", "gpt-5", "ultra", undefined],
])("an effort change: %s", async (_, agent, model, effort, refusal) => {
  const runtimes = await lists();
  const run = () => checkEffort(runtimes, agent, model, effort);
  if (refusal === undefined) {
    expect(run).not.toThrow();
  } else {
    expect(run).toThrow(refusal);
  }
});

test.each<[string, Record<string, unknown>]>([
  ["a number as the model", { model: 5 }],
  ["an object as the effort", { effort: { id: "high" } }],
  ["a list as the runtime", { runtime: ["codex"] }],
])("a pick of %s is refused, as fate's inputs are not typed when they run", (_, input) => {
  expect(() => pickOf(input as SessionPick)).toThrow(/^refused: .* is not a name: pick another$/);
});

test("a pick of names, or of nothing, is the pick: null is left out", () => {
  expect(pickOf({ effort: "high", model: "m", runtime: "codex" })).toEqual({
    effort: "high",
    model: "m",
    runtime: "codex",
  });
  expect(pickOf({})).toEqual({ effort: undefined, model: undefined, runtime: undefined });
  expect(pickOf({ model: null } as unknown as SessionPick)).toEqual({
    effort: undefined,
    model: undefined,
    runtime: undefined,
  });
});
