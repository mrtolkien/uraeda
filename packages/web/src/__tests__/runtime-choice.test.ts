// Which runtime a message goes to, as the composer, a page's chat, and the start dialog resolve it:
// a session's by the name it stored, a new session's by the pick while it is on, else the first on.
import { describe, expect, test } from "vite-plus/test";
import { RUNTIME_REFUSALS } from "uraeda-server/limits";
import { pickedRuntime, type Runtime, runtimeFor, runtimeRefusal } from "../runtimes.ts";

function runtime(kind: string, isOn: boolean, available = true): Runtime {
  return {
    available,
    capabilities: {} as Runtime["capabilities"],
    icon: "bot",
    isOn,
    kind,
    name: `${kind} name`,
    title: `${kind} title`,
    usage: [],
    version: null,
  };
}

const claude = runtime("claude", true);
const codex = runtime("codex", true);
const pi = runtime("pi", false);
const gone = runtime("gone", true, false);

describe("runtimeFor", () => {
  test.each([
    // [what, runtimes, kind, picked, the runtime chosen, the refusal]
    ["a session's runtime, on", [claude, codex], "codex", undefined, "codex", undefined],
    [
      "a session's runtime, on, whatever is picked",
      [claude, codex],
      "codex",
      "claude",
      "codex",
      undefined,
    ],
    [
      "a session's runtime, off",
      [claude, pi],
      "pi",
      undefined,
      "pi",
      RUNTIME_REFUSALS.runtimeOff("pi title"),
    ],
    [
      "a session's runtime, unregistered",
      [claude],
      "nope",
      undefined,
      undefined,
      RUNTIME_REFUSALS.runtimeOff("nope"),
    ],
    ["a new session, nothing picked", [claude, codex], undefined, undefined, "claude", undefined],
    ["a new session, the pick on", [claude, codex], undefined, "codex", "codex", undefined],
    ["a new session, the pick off", [claude, pi], undefined, "pi", "claude", undefined],
    [
      "a new session, the pick unregistered",
      [claude, codex],
      undefined,
      "nope",
      "claude",
      undefined,
    ],
    ["a new session, the first off", [pi, codex], undefined, undefined, "codex", undefined],
    ["a new session, none on", [pi], undefined, "pi", undefined, RUNTIME_REFUSALS.noRuntime],
    [
      "a new session, none registered",
      [],
      undefined,
      undefined,
      undefined,
      RUNTIME_REFUSALS.noRuntime,
    ],
    ["an empty kind reads as none", [claude, codex], "", "codex", "codex", undefined],
  ] as const)("%s", (_, runtimes, kind, picked, chosen, off) => {
    const choice = runtimeFor(runtimes, kind, picked);
    expect(choice.runtime?.kind).toBe(chosen);
    expect(choice.off).toBe(off);
  });
});

describe("runtimeRefusal", () => {
  test.each([
    ["on and available", [claude], undefined, undefined, undefined],
    [
      "on but not on this machine",
      [gone],
      undefined,
      undefined,
      RUNTIME_REFUSALS.unavailable("gone name"),
    ],
    [
      "a session's runtime off",
      [claude, pi],
      "pi",
      undefined,
      RUNTIME_REFUSALS.runtimeOff("pi title"),
    ],
    ["none on", [pi], undefined, undefined, RUNTIME_REFUSALS.noRuntime],
    ["the pick off falls to one available", [claude, pi], undefined, "pi", undefined],
    [
      "the pick unavailable",
      [claude, gone],
      undefined,
      "gone",
      RUNTIME_REFUSALS.unavailable("gone name"),
    ],
  ] as const)("%s", (_, runtimes, kind, picked, refusal) => {
    expect(runtimeRefusal(runtimeFor(runtimes, kind, picked))).toBe(refusal);
  });
});

describe("pickedRuntime, what a new session's message sends", () => {
  test.each([
    ["nothing picked: the first on", [claude, codex], undefined, "claude"],
    ["the pick on", [claude, codex], "codex", "codex"],
    // The bug: a pick turned off since was sent as it was, while the picker showed the first on.
    [
      "the pick turned off: the first on, as the picker shows",
      [claude, runtime("codex", false)],
      "codex",
      "claude",
    ],
    ["the pick unregistered since: the first on", [codex], "claude", "codex"],
    ["none on: nothing", [pi], "pi", undefined],
  ] as const)("%s", (_, runtimes, picked, sent) => {
    expect(pickedRuntime(runtimes, picked)).toBe(sent);
  });
});
