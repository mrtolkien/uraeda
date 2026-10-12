import { expect, test } from "vite-plus/test";
import type { Denial } from "../events.ts";
import {
  allowRule,
  runMessage,
  toolTarget,
  triggerSentence,
  type TriggerDetail,
} from "../message.ts";

test.each<[TriggerDetail, string]>([
  [
    { trigger: "answers", file: "clarifications-01.md" },
    "The human answered round 01 of the questions.",
  ],
  [{ trigger: "approval", file: "spec.md" }, "The human approved the spec."],
  [{ trigger: "approval", file: "assessment.md" }, "The human approved the assessment."],
  [{ trigger: "changes", file: "plan.md" }, "The human requested changes on the plan."],
  [{ trigger: "proposal", file: "proposal.md" }, "The human committed the proposal."],
  [{ trigger: "proposal", file: "report.md" }, "The human committed the bug report."],
  [{ trigger: "start" }, "The human started the feature."],
  [{ trigger: "manual" }, "The human asked you to continue."],
  [
    { trigger: "allow", rule: "Bash(gh pr create --draft)" },
    "The human allowed `Bash(gh pr create --draft)`: run it again, then continue.",
  ],
])("the sentence of %o", (detail, sentence) => expect(triggerSentence(detail)).toBe(sentence));

test.each<[Denial, string]>([
  [{ tool: "Bash", input: { command: "gh pr create --draft" } }, "Bash(gh pr create --draft)"],
  [{ tool: "Write", input: { file_path: "/home/me/.ssh/config" } }, "Write(/home/me/.ssh/config)"],
  [{ tool: "Edit", input: { file_path: "/w/a.ts" } }, "Edit(/w/a.ts)"],
  [{ tool: "Read", input: { file_path: "/w/b.ts" } }, "Read(/w/b.ts)"],
  [{ tool: "WebFetch", input: { url: "https://example.com/a?b" } }, "WebFetch(domain:example.com)"],
  [{ tool: "mcp__x__y", input: {} }, "mcp__x__y"],
])("the allow rule of %o", (denial, rule) => expect(allowRule(denial)).toBe(rule));

test.each<[string, Record<string, unknown>, string | undefined]>([
  ["Bash", { command: "vp run ready", description: "Run the checks" }, "vp run ready"],
  ["Read", { file_path: "/w/a.ts" }, "/w/a.ts"],
  ["WebFetch", { url: "https://example.com", prompt: "x" }, "https://example.com"],
  ["Grep", { pattern: "TODO", path: "src" }, "TODO"],
  ["Glob", { path: "src" }, "src"],
  ["TodoWrite", { todos: [] }, undefined],
])("the target of %s %o", (name, input, target) => expect(toolTarget(name, input)).toBe(target));

test("the message names the skill, the step, its reference, and the trigger", () => {
  expect(
    runMessage({
      folder: "2026-10-12-cli-tuis",
      branch: "2026-10-12-cli-tuis",
      step: "plan",
      reference: "skills/uraeda/references/plan.md",
      detail: { trigger: "manual" },
    }),
  ).toBe(
    "/uraeda:uraeda Continue the feature specs/2026-10-12-cli-tuis/, on branch 2026-10-12-cli-tuis.\n" +
      "The human asked you to continue.\n" +
      "Its next step is plan: follow skills/uraeda/references/plan.md.\n" +
      "No chat session is attached: work until the next human gate, and commit every step. The commit is\nthe message.\n",
  );
});

test("a bug's message names its folder under specs/bugs/", () => {
  expect(
    runMessage({
      folder: "2026-10-14-lost-undo",
      branch: "fix/2026-10-14-lost-undo",
      bug: true,
      step: "assess",
      reference: "skills/uraeda/references/bug.md",
      detail: { trigger: "proposal", file: "report.md" },
    }),
  ).toMatch(
    /^\/uraeda:uraeda Continue the bug specs\/bugs\/2026-10-14-lost-undo\/, on branch fix\/2026-10-14-lost-undo\.\nThe human committed the bug report\.\n/,
  );
});
