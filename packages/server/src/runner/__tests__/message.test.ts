import { expect, test } from "vite-plus/test";
import type { Denial } from "../events.ts";
import {
  allowRule,
  chatOpening,
  chatTitle,
  retryMessage,
  runMessage,
  toolTarget,
  triggerSentence,
} from "../message.ts";

test.each<[Parameters<typeof triggerSentence>[0], string]>([
  [
    { trigger: "answers", file: "clarifications-01.md" },
    "The human answered clarifications-01.md of the questions.",
  ],
  [{ trigger: "approval", file: "spec.md" }, "The human approved the spec."],
  [{ trigger: "approval", file: "assessment.md" }, "The human approved the assessment."],
  [{ trigger: "changes", file: "plan.md" }, "The human requested changes on the plan."],
  [{ trigger: "proposal", file: "proposal.md" }, "The human committed the proposal."],
  [{ trigger: "proposal", file: "report.md" }, "The human committed the bug report."],
  [{ trigger: "start" }, "The human started the feature."],
  [{ trigger: "manual" }, "The human asked you to continue."],
])("the sentence of %o", (detail, sentence) => expect(triggerSentence(detail)).toBe(sentence));

test.each<[Denial, string]>([
  [{ tool: "Bash", input: { command: "gh pr create --draft" } }, "Bash(gh pr create --draft)"],
  // An absolute path takes two slashes: one is relative to the settings' folder. Claude Code checks
  // a write against `Edit` rules only.
  [{ tool: "Write", input: { file_path: "/home/me/.ssh/config" } }, "Edit(//home/me/.ssh/config)"],
  [{ tool: "MultiEdit", input: { file_path: "/w/a.ts" } }, "Edit(//w/a.ts)"],
  [{ tool: "Edit", input: { file_path: "/w/a.ts" } }, "Edit(//w/a.ts)"],
  [{ tool: "Read", input: { file_path: "/w/b.ts" } }, "Read(//w/b.ts)"],
  [{ tool: "Edit", input: { file_path: "src/a.ts" } }, "Edit(src/a.ts)"],
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

test.each<[string, Record<string, unknown>, string | undefined]>([
  ["Read", { file_path: "/repo/specs/a.md" }, "specs/a.md"],
  ["Glob", { pattern: "**/*.md", path: "/repo/specs" }, "**/*.md"],
  ["Grep", { pattern: "TODO", path: "/repo/src" }, "TODO"],
  ["LS", { path: "/repo/src" }, "src"],
  ["Read", { file_path: "/elsewhere/b.md" }, "/elsewhere/b.md"],
  ["Read", { file_path: "/repository/c.md" }, "/repository/c.md"],
  ["Bash", { command: "cat /repo/a.md" }, "cat /repo/a.md"],
])("the target of %s %o in /repo", (name, input, target) =>
  expect(toolTarget(name, input, "/repo")).toBe(target),
);

test("the message names the skill, the step, its reference, and the trigger", () => {
  expect(
    runMessage({
      folder: "2026-10-12-cli-tuis",
      branch: "2026-10-12-cli-tuis",
      step: "plan",
      reference: "skills/uraeda/references/plan.md",
      trigger: "manual",
    }),
  ).toBe(
    "/uraeda:uraeda Continue the feature specs/2026-10-12-cli-tuis/, on branch 2026-10-12-cli-tuis.\n" +
      "The human asked you to continue.\n" +
      "Its next step is plan: follow skills/uraeda/references/plan.md.\n",
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
      trigger: "proposal",
      file: "report.md",
    }),
  ).toMatch(
    /^\/uraeda:uraeda Continue the bug specs\/bugs\/2026-10-14-lost-undo\/, on branch fix\/2026-10-14-lost-undo\.\nThe human committed the bug report\.\n/,
  );
});

test("the message of answered questions is three lines", () => {
  expect(
    runMessage({
      folder: "2026-10-13-chat",
      branch: "2026-10-13-chat",
      step: "spec",
      reference: "skills/uraeda/references/spec.md",
      trigger: "answers",
      file: "clarifications-01.md",
    }),
  ).toBe(
    "/uraeda:uraeda Continue the feature specs/2026-10-13-chat/, on branch 2026-10-13-chat.\n" +
      "The human answered clarifications-01.md of the questions.\n" +
      "Its next step is spec: follow skills/uraeda/references/spec.md.\n",
  );
});

test("the chat's opening line", () => {
  expect(chatOpening({ folder: "2026-10-13-chat", branch: "2026-10-13-chat" })).toBe(
    "A human is chatting with you about the feature specs/2026-10-13-chat/, on branch " +
      "2026-10-13-chat: answer, and change files, commit, or move the workflow only when they ask.",
  );
});

test("the retry message names the allowed action", () => {
  expect(retryMessage({ tool: "Bash", target: "git push origin HEAD" })).toBe(
    "Try the blocked action again, now allowed: Bash git push origin HEAD",
  );
  expect(retryMessage({ tool: "mcp__x__y" })).toBe(
    "Try the blocked action again, now allowed: mcp__x__y",
  );
});

test.each<[string, string]>([
  ["x".repeat(90), "x".repeat(80)],
  ["List the open draft files", "List the open draft files"],
  ["  \n  Fix the build  \nthen push", "Fix the build"],
  [" \n ", "New chat"],
])("the title of %j", (text, title) => expect(chatTitle(text)).toBe(title));
