// @vitest-environment node
// Storybook's fixture after the sample builders moved to `samples/`: the same features, at the same
// steps, as it held before the move, read through the binding's workspace view.
import { readWorkspace, refreshPullRequests } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import { storybookFixture } from "../../.storybook/fixture.ts";
import { listPullRequest } from "../index.ts";

/** Each feature's and change's step, by folder, as the workspace view reads them. */
async function stepsOf(repo: string): Promise<Record<string, string>> {
  const { features } = await readWorkspace(repo);
  return Object.fromEntries(features.map(({ folder, step }) => [folder, step.name]));
}

/** The steps Storybook's fixture held before the move, read from it then. */
const STORYBOOK_STEPS = {
  "2026-10-06-recurring-tasks": "human-gate",
  "2026-10-10-cli-core": "done",
  "2026-10-10-stack-decision": "done",
  "2026-10-11-web-ui": "human-gate",
  "2026-10-12-cli-tuis": "plan",
  "2026-10-13-plan-review": "human-gate",
  "2026-10-17-due-dates": "none",
  "2026-10-17-keyboard-shortcuts": "pull-request",
  "2026-10-17-recurring-reminders": "human-gate",
  "2026-10-17-redesign-clarifications": "implementation",
  "2026-10-17-redesign-rounds": "done",
  "2026-10-17-round-mockup": "human-gate",
  "2026-10-17-round-mockup-comment": "human-gate",
  "2026-10-17-spec-page": "human-gate",
  "2026-10-17-spec-page-approved": "discovery",
  "2026-10-17-symlinks": "done",
  "2026-10-20-sidebar-resize": "human-gate",
  "2026-10-21-slow-preview": "discovery",
  "2026-10-22-broken-preview": "discovery",
  "2026-10-23-no-worktree": "discovery",
};

test("Storybook's fixture holds the same features at the same steps", async () => {
  // The `gh` Storybook's server is given, read as the server reads it: the finished feature's pull
  // request is open.
  listPullRequest();
  const { repo } = storybookFixture();
  await refreshPullRequests(repo);

  expect(await stepsOf(repo)).toEqual(STORYBOOK_STEPS);
});
