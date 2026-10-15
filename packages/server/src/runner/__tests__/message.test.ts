import { expect, test } from "vite-plus/test";
import { chatOpening, chatTitle, retryMessage, runMessage, toolTarget } from "../message.ts";

test.each<[string, Record<string, unknown>, string | undefined]>([
  ["Bash", { command: "vp run ready", description: "Run the checks" }, "vp run ready"],
  ["Read", { file_path: "/w/a.ts" }, "/w/a.ts"],
  ["WebFetch", { prompt: "x", url: "https://example.com" }, "https://example.com"],
  ["Grep", { path: "src", pattern: "TODO" }, "TODO"],
  ["Glob", { path: "src" }, "src"],
  ["TodoWrite", { todos: [] }, undefined],
])("the target of %s %o", (name, input, target) => expect(toolTarget(name, input)).toBe(target));

test.each<[string, Record<string, unknown>, string | undefined]>([
  ["Read", { file_path: "/repo/specs/a.md" }, "specs/a.md"],
  ["Glob", { path: "/repo/specs", pattern: "**/*.md" }, "**/*.md"],
  ["Grep", { path: "/repo/src", pattern: "TODO" }, "TODO"],
  ["LS", { path: "/repo/src" }, "src"],
  ["Read", { file_path: "/elsewhere/b.md" }, "/elsewhere/b.md"],
  ["Read", { file_path: "/repository/c.md" }, "/repository/c.md"],
  ["Bash", { command: "cat /repo/a.md" }, "cat /repo/a.md"],
])("the target of %s %o in /repo", (name, input, target) =>
  expect(toolTarget(name, input, "/repo")).toBe(target),
);

const PLAN = {
  branch: "2026-10-12-cli-tuis",
  folder: "2026-10-12-cli-tuis",
  reference: "skills/uraeda/references/plan.md",
  step: "plan",
};

test("the message names the skill, the goal, the reference, and where to stop", () => {
  expect(runMessage({ ...PLAN, planReview: false })).toBe(
    "/uraeda:uraeda Continue the feature specs/2026-10-12-cli-tuis/ on branch 2026-10-12-cli-tuis: " +
      "Write the plan, then implement it, starting with skills/uraeda/references/plan.md.\n" +
      "Stop when the pull request is ready for review, and earlier only if you need a decision from me.\n",
  );
});

test("a plan the human reviews stops at its review", () => {
  expect(runMessage({ ...PLAN, planReview: true })).toMatch(
    /: Write the plan, starting with .*\nStop when the plan waits for my review, /,
  );
});

test("a spec without plan-review runs through the implementation", () => {
  expect(runMessage({ ...PLAN, step: "approval" })).toMatch(
    /: Record the approved decisions and write the plan, then implement it, .*\nStop when the pull request is ready for review, /,
  );
});

test.each<[string, string]>([
  ["discovery", "the questions wait for my answers"],
  ["spec", "the spec waits for my review"],
  ["spec-revision", "the spec waits for my review again"],
  ["implementation", "the pull request is ready for review"],
  ["pull-request-changes", "the pull request is ready for review again"],
  ["assess", "the assessment waits for my review"],
  ["fix", "the pull request is ready for review"],
])("the run of %s stops when %s", (step, stop) =>
  expect(runMessage({ ...PLAN, step })).toContain(`\nStop when ${stop}, `),
);

test("a bug's message names its folder under specs/bugs/", () => {
  expect(
    runMessage({
      branch: "fix/2026-10-14-lost-undo",
      bug: true,
      folder: "2026-10-14-lost-undo",
      reference: "skills/uraeda/references/bug.md",
      step: "assess",
    }),
  ).toMatch(
    /^\/uraeda:uraeda Continue the bug specs\/bugs\/2026-10-14-lost-undo\/ on branch fix\/2026-10-14-lost-undo: Find the root cause/,
  );
});

test("the message does not say what the human did", () => {
  expect(runMessage(PLAN)).not.toMatch(/the human/i);
});

test("the chat's opening line", () => {
  expect(chatOpening({ branch: "2026-10-13-chat", folder: "2026-10-13-chat" })).toBe(
    "A human is chatting with you about the feature specs/2026-10-13-chat/, on branch " +
      "2026-10-13-chat: answer, and change files, commit, or move the workflow only when they ask.",
  );
});

test("the retry message names the allowed action", () => {
  expect(retryMessage({ target: "git push origin HEAD", tool: "Bash" })).toBe(
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

test('a chat of text and images is titled by its text, and of images alone "Image"', () => {
  expect(chatTitle("What is wrong here?", true)).toBe("What is wrong here?");
  expect(chatTitle(" \n", true)).toBe("Image");
});
