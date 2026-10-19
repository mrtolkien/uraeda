import { expect, test } from "vite-plus/test";
import { openBrowser } from "uraeda-server/browser";
import { ClaudeAdapter } from "uraeda-server/runner/claude";
import { FakeAdapter } from "uraeda-server/runner/fake";
import { runMessage } from "uraeda-server/runner/message";

test("SC-005: the runner reaches the server's adapter, message, and browser, with no copy", () => {
  const message = runMessage({
    branch: "b",
    feature: { kind: "feature", path: "specs/f" },
    reference: "skills/uraeda/references/discovery.md",
    step: "discovery",
  });

  expect(message).toContain("/uraeda Continue the feature specs/f/ on branch b");
  expect([typeof ClaudeAdapter, typeof FakeAdapter, typeof openBrowser]).toEqual([
    "function",
    "function",
    "function",
  ]);
});
