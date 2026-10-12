import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, test } from "vite-plus/test";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const ROUND = `/f/${WEB_UI}/clarifications-01.md`;
const RECURRING = "2026-10-06-recurring-tasks";
const SPEC = `/f/${RECURRING}/spec.md`;

beforeAll(() => {
  process.env.URA_TODAY = "2026-10-12";
});

async function tap(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function type(element: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

/** A repository whose round 01 has every question answered, in the feature's worktree. */
function answeredRepo() {
  const repo = fixtureRepo();
  const worktree = join(".worktrees", WEB_UI);
  git(repo, "worktree", "add", "--quiet", worktree, WEB_UI);
  const path = join(repo, worktree, "specs", WEB_UI, "clarifications-01.md");
  writeFileSync(
    path,
    readFileSync(path, "utf8").replaceAll(/^\*\*Answer:\*\*$/gm, "**Answer:** A"),
  );
  return repo;
}

/** A pre-commit hook that refuses every commit until `pass` is called. */
function refusingHook(repo: string) {
  const hooks = join(repo, ".git/hooks");
  git(repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused'\nexit 1\n", { mode: 0o755 });
  return { pass: () => writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n") };
}

/** US1.6 */
test("US1.6: without claude, the round keeps Submit answers", async () => {
  await renderPage(ROUND, answeredRepo());

  expect(await screen.findByRole("button", { name: "Submit answers" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Commit and continue" })).toBeNull();
});

/** US1.1 */
test("US1.1: Commit and continue commits the round and starts the agent", async () => {
  const { agent, repo } = await renderPage(ROUND, answeredRepo(), { agent: true });

  await tap(await screen.findByRole("button", { name: "Commit and continue" }));

  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(agent.starts[0].message).toContain("The human answered round 01 of the questions.");
  expect(agent.starts[0].message).toContain("Its next step is spec");
  expect(await screen.findByText("The agent is working on the spec.")).toBeTruthy();
});

/** US1.2, SC-004 */
test("US1.2: Commit only commits, and starts nothing", async () => {
  const { agent, repo } = await renderPage(ROUND, answeredRepo(), { agent: true });

  await tap(await screen.findByRole("button", { name: "Commit only" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  expect(agent.starts).toHaveLength(0);
});

/** US1.3 */
test("US1.3: approving a spec with Commit and continue starts the agent", async () => {
  const { agent, repo } = await renderPage(SPEC, fixtureRepo(), { agent: true });
  expect(await screen.findByRole("button", { name: "Approve only" })).toBeTruthy();

  await tap(screen.getByRole("button", { name: "Approve and continue" }));

  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(git(repo, "log", "-1", "--format=%s", RECURRING).trim()).toBe(
    "spec(recurring-tasks): approve",
  );
  expect(agent.starts[0].message).toContain("The human approved the spec.");
});

test("requesting changes with Commit and continue starts the agent", async () => {
  const { agent, repo } = await renderPage(SPEC, fixtureRepo(), { agent: true });
  await tap(await screen.findByRole("button", { name: "Add a general comment" }));
  await type(await screen.findByLabelText("Comment text"), "Say more about time zones");
  await tap(screen.getByRole("button", { name: "Add comment" }));

  const button = await screen.findByRole("button", { name: "Request changes and continue" });
  await waitFor(() => expect(button.getAttribute("aria-disabled")).not.toBe("true"));
  await tap(button);

  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(git(repo, "log", "-1", "--format=%s", RECURRING).trim()).toBe(
    "spec(recurring-tasks): request changes",
  );
  expect(agent.starts[0].message).toContain("The human requested changes on the spec.");
});

test("committing a proposal and starting a feature offer both buttons", async () => {
  const repo = fixtureRepo();
  git(repo, "branch", "2026-10-14-runner", "main");
  git(repo, "worktree", "add", "--quiet", ".worktrees/2026-10-14-runner", "2026-10-14-runner");
  const proposal = join(repo, ".worktrees/2026-10-14-runner/specs/2026-10-14-runner/proposal.md");
  mkdirSync(join(proposal, ".."), { recursive: true });
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun agents.\n\n## Why\n\nSpeed.\n");
  const { agent } = await renderPage("/edit/specs/2026-10-14-runner/proposal.md", repo, {
    agent: true,
  });

  await tap(await screen.findByRole("button", { name: "Commit and continue" }));

  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(git(repo, "log", "-1", "--format=%s", "2026-10-14-runner").trim()).toBe(
    "chore(runner): proposal",
  );
  expect(agent.starts[0].message).toContain("The human committed the proposal.");
  expect(await screen.findByText("The agent is working on the discovery.")).toBeTruthy();

  window.history.replaceState(null, "", "/edit/specs/drafts/git-listener.md");
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
  await type(await screen.findByLabelText("Slug"), "git-listener");
  expect(screen.getByRole("button", { name: "Start only" })).toBeTruthy();
  await tap(screen.getByRole("button", { name: "Start and continue" }));

  await waitFor(() => expect(agent.starts).toHaveLength(2));
  expect(agent.starts[1].message).toContain("The human started the feature.");
  expect(agent.starts[1].message).toContain("specs/2026-10-12-git-listener/");
  await waitFor(() => expect(window.location.pathname).toBe("/f/2026-10-12-git-listener"));
});

test("a draft's Commit keeps its single button", async () => {
  await renderPage("/edit/specs/drafts/git-listener.md", fixtureRepo(), { agent: true });

  expect(await screen.findByRole("button", { name: "Commit" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Commit and continue" })).toBeNull();
});

/** US1.5 */
test("US1.5: Try again after a refused hook keeps Commit and continue", async () => {
  const repo = answeredRepo();
  const hook = refusingHook(repo);
  const { agent } = await renderPage(ROUND, repo, { agent: true });

  await tap(await screen.findByRole("button", { name: "Commit and continue" }));
  expect(
    await screen.findByText(
      "The pre-commit hook refused the commit. Your answers are saved, not committed.",
    ),
  ).toBeTruthy();
  expect(agent.starts).toHaveLength(0);
  hook.pass();
  await tap(screen.getByRole("button", { name: "Try again" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(agent.starts[0].message).toContain("The human answered round 01 of the questions.");
});

test("a refused run says why, and the commit stays done", async () => {
  const repo = answeredRepo();
  const { agent, runner } = await renderPage(ROUND, repo, { agent: true });
  await screen.findByRole("button", { name: "Commit and continue" });
  // Claude Code goes away after the page showed its buttons.
  agent.installed = false;
  await runner.check();

  await tap(screen.getByRole("button", { name: "Commit and continue" }));

  expect(await screen.findByText("Claude Code is not available on this machine.")).toBeTruthy();
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(agent.starts).toHaveLength(0);
});
