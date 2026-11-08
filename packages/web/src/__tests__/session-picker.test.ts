// What a session runs on, as the picker reads it: the button's text, the model step's rows, the
// effort a model or an agent change resets, the runtimes the picker offers, and what a new session's
// input sends. Over the stories' two runtimes, as Claude Code and Codex listed them.
import { describe, expect, test } from "vite-plus/test";
import { pickSent, type Runtime } from "../runtimes.ts";
import { CLAUDE, CODEX } from "../sampleRuntimes.ts";
import { modelItems, pickerRuntimes, pickLabel, withModel } from "../SessionPicker.tsx";

describe("the picker's rules", () => {
  test.each([
    [
      "the default row names what it resolves to, marked picked",
      () => {
        const row = modelItems([CODEX], { runtime: "codex" })[0];
        return { aside: row?.aside, title: row?.title };
      },
      { aside: "picked", title: "Codex · Default · GPT-6.1-Sol" },
    ],
    [
      "the button resolves the defaults",
      () => pickLabel(CODEX, { runtime: "codex" }),
      "Codex · GPT-6.1-Sol · Medium",
    ],
    [
      "on the phone, the agent's mark names the agent",
      () => pickLabel(CODEX, { effort: "high", model: "gpt-6-astra", runtime: "codex" }, true),
      "GPT-6-Astra · High",
    ],
    [
      "a model without efforts",
      () => pickLabel(CLAUDE, { model: "claude-haiku-4-5-20251001", runtime: "claude" }),
      "Claude Code · Haiku 4.5",
    ],
    [
      "a model that stops below the effort resets it",
      () => withModel(CODEX, { effort: "ultra", runtime: "codex" }, "gpt-6-luna"),
      { model: "gpt-6-luna", runtime: "codex" },
    ],
    [
      "a model that takes the effort keeps it",
      () => withModel(CODEX, { effort: "ultra", runtime: "codex" }, "gpt-6-astra"),
      { effort: "ultra", model: "gpt-6-astra", runtime: "codex" },
    ],
    [
      "another agent resets the effort",
      () => withModel(CLAUDE, { effort: "high", model: "gpt-6-astra", runtime: "codex" }, "sonnet"),
      { model: "sonnet", runtime: "claude" },
    ],
    [
      "one agent on lists its models alone",
      () => modelItems([CLAUDE], { runtime: "claude" }).every((i) => i.title.startsWith("Claude")),
      true,
    ],
  ] as const)("%s", (_, run, expected) => {
    expect(run()).toEqual(expected);
  });
});

function runtime(kind: string, isOn: boolean, models: Runtime["models"] = null): Runtime {
  return {
    available: true,
    capabilities: {} as Runtime["capabilities"],
    icon: "",
    isOn,
    kind,
    models,
    name: `${kind} name`,
    title: `${kind} title`,
    usage: [],
    version: null,
  };
}

const codex = runtime("codex", true, {
  defaults: { effort: "medium", model: "gpt-6.1-sol" },
  models: [{ efforts: [{ id: "high", name: "High" }], id: "gpt-6.1-sol", name: "GPT-6.1-Sol" }],
});
const claude = runtime("claude", true);

describe("pickerRuntimes", () => {
  test("a runtime with a list gives its models and defaults, one without gives none", () => {
    expect(
      pickerRuntimes([codex, claude]).map(({ defaults, kind, models, name }) => ({
        defaults,
        kind,
        models: models.map((model) => model.id),
        name,
      })),
    ).toEqual([
      {
        defaults: { effort: "medium", model: "gpt-6.1-sol" },
        kind: "codex",
        models: ["gpt-6.1-sol"],
        name: "codex name",
      },
      { defaults: {}, kind: "claude", models: [], name: "claude name" },
    ]);
  });
  test("a runtime without a list offers only Default, named alone", () => {
    expect(modelItems(pickerRuntimes([claude]), { runtime: "claude" }).map((i) => i.title)).toEqual(
      ["claude name · Default"],
    );
  });
});

describe("pickSent, what a new session's input sends", () => {
  test.each([
    [
      "nothing picked: the first on, on its defaults",
      [claude, codex],
      undefined,
      { runtime: "claude" },
    ],
    [
      "the pick on: its model and effort",
      [claude, codex],
      { effort: "high", model: "gpt-6.1-sol", runtime: "codex" },
      { effort: "high", model: "gpt-6.1-sol", runtime: "codex" },
    ],
    // A pick turned off since sends the first on, never the old agent's model.
    [
      "the pick turned off: the first on, without the pick's model",
      [claude, runtime("codex", false)],
      { effort: "high", model: "gpt-6.1-sol", runtime: "codex" },
      { runtime: "claude" },
    ],
    ["none on: nothing", [runtime("pi", false)], { runtime: "pi" }, {}],
  ] as const)("%s", (_, runtimes, pick, sent) => {
    expect(pickSent(runtimes, pick)).toEqual(sent);
  });
});
