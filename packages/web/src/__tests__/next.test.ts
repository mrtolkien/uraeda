// What "Next" offers at each step: who acts and the one action, from the step, the recommended
// message, and the agent. The feature-page spec's US1.1 and US2, and its edge case of no agent.
import { expect, test } from "vite-plus/test";
import { type NextFeature, nextOf } from "../feature/next.ts";

const FOLDER = "2026-10-12-cli-tuis";
const AVAILABLE = { available: true, name: "Claude Code" };

/** A feature at `step`, waiting on the agent unless it says otherwise. */
function at(name: string, extra: Partial<NextFeature["step"]> = {}): NextFeature {
  return {
    files: [],
    folder: FOLDER,
    path: `specs/${FOLDER}`,
    step: { file: null, fileKind: null, name, waitsOn: "agent", ...extra },
  } as NextFeature;
}

const RECOMMENDED = { name: "Continue, write the plan", trigger: "manual" } as const;

test("an idle agent at a step offers the recommended message as its button", () => {
  const next = nextOf(at("plan"), { agent: AVAILABLE, recommended: RECOMMENDED, working: false });

  expect(next.title).toBe("The agent writes the plan");
  expect(next.action).toEqual({
    kind: "continue",
    label: "Continue, write the plan",
    trigger: "manual",
  });
});

test("a working agent offers Open the session", () => {
  const next = nextOf(at("plan"), { agent: AVAILABLE, recommended: RECOMMENDED, working: true });

  expect(next.action).toEqual({
    external: false,
    href: `/f/${FOLDER}/session`,
    kind: "link",
    label: "Open the session",
  });
});

test("a build with the agent working keeps its task line", () => {
  const progress = { position: 5, title: "Undo restores the previous due date", total: 9 };

  const next = nextOf(at("implementation", { progress }), {
    agent: AVAILABLE,
    recommended: RECOMMENDED,
    working: true,
  });

  expect(next.title).toBe("The agent is building");
  expect(next.line).toBe("Task 5 of 9: Undo restores the previous due date");
  expect(next.action?.label).toBe("Open the session");
});

test("an idle agent with only a reason says it and offers Open the session", () => {
  const next = nextOf(at("plan"), {
    agent: AVAILABLE,
    recommended: { reason: "The plan waits for the spec" },
    working: false,
  });

  expect(next.line).toBe("The plan waits for the spec");
  expect(next.action?.label).toBe("Open the session");
});

test("an unavailable agent has no action and says so", () => {
  const next = nextOf(at("plan"), {
    agent: { available: false, name: "Claude Code" },
    recommended: RECOMMENDED,
    working: false,
  });

  expect(next.action).toBeUndefined();
  expect(next.line).toBe("Claude Code is not available on this machine");
});

test("a human gate keeps its link, whatever the agent", () => {
  const next = nextOf(at("spec-review", { file: "spec.md", fileKind: "spec", waitsOn: "human" }), {
    agent: { available: false, name: "Claude Code" },
    recommended: undefined,
    working: false,
  });

  expect(next.title).toBe("You review the spec");
  expect(next.action?.kind).toBe("link");
});
