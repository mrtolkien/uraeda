// US2 and C2: the buttons that commit and hand over to the agent, and the session they open with
// the workflow's message in its composer, unsent.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, refreshUntil, renderPage, today, type } from "./helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const ROUND = `/f/${WEB_UI}/clarifications-01.md`;
const CLI = "2026-10-12-cli-tuis";
const RECURRING = "2026-10-06-recurring-tasks";
const SPEC = `/f/${RECURRING}/spec.md`;

/** The workflow's message once round 01 of the web UI is answered. */
const ANSWERED = [
  `/uraeda:uraeda Continue the feature specs/${WEB_UI}/, on branch ${WEB_UI}.`,
  "The human answered clarifications-01.md of the questions.",
  "Its next step is spec: follow skills/uraeda/references/spec.md.",
].join("\n");

/** The workflow's message when the human asks the CLI's agent to continue. */
const MANUAL = [
  `/uraeda:uraeda Continue the feature specs/${CLI}/, on branch ${CLI}.`,
  "The human asked you to continue.",
  "Its next step is plan: follow skills/uraeda/references/plan.md.",
].join("\n");

today("2026-10-12");

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

/** The session's composer, once it is drawn. */
function composer() {
  return screen.findByRole("textbox", { name: "Message Claude Code" });
}

/** The composer's "Start the agent", not the one of the feature page beside it. */
function startInComposer() {
  const panel = screen.queryByRole("region", { name: "Agent" });
  const button = screen
    .getAllByRole("button", { name: "Start the agent" })
    .find((element) => !panel?.contains(element));
  if (!button) {
    throw new Error("No Start the agent in the composer");
  }
  return button;
}

/** Waits for the feature's session to open with `text` in its composer. */
async function opensWith(folder: string, text: string | RegExp) {
  await waitFor(() => expect(window.location.pathname).toBe(`/f/${folder}/session`));
  const box = await composer();
  await waitFor(() =>
    typeof text === "string"
      ? expect(box.textContent).toBe(text)
      : expect(box.textContent).toMatch(text),
  );
  return box;
}

/** US1.6 */
test("without claude, the round keeps Submit answers", async () => {
  await renderPage(ROUND, answeredRepo());

  expect(await screen.findByRole("button", { name: "Submit answers" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Commit and start the agent" })).toBeNull();
});

/** US2.1 */
test("US2.1: Commit and start the agent commits, then opens the session with the message, unsent", async () => {
  const { agent, repo } = await renderPage(ROUND, answeredRepo(), { agent: true });

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));

  await opensWith(WEB_UI, ANSWERED);
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(window.location.search).toBe("?continue=answers&file=clarifications-01.md");
  expect(agent.sent).toHaveLength(0);
});

/** US2.2 */
test("US2.2: Start the agent hands over, with the note", async () => {
  const { agent } = await renderPage(ROUND, answeredRepo(), { agent: true });
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  const box = await opensWith(WEB_UI, ANSWERED);

  await type(box, `${ANSWERED}\nKeep the spec short.`);
  await click(startInComposer());

  await waitFor(() => expect(agent.sent).toHaveLength(1));
  expect(agent.sent[0].text.endsWith("Keep the spec short.")).toBe(true);
  expect(agent.sent[0].text).toContain("The human answered clarifications-01.md of the questions.");
  await refreshUntil(() =>
    expect(
      within(screen.getByRole("log", { name: "Conversation" })).getByText("Run: Spec"),
    ).toBeTruthy(),
  );
  // The address no longer holds the message: Send is back.
  expect(window.location.search).toBe("");
  expect((await composer()).textContent).toBe("");
});

/** US2.4 */
test("US2.4: a feature that waits on you again refuses the message, and keeps it", async () => {
  const repo = answeredRepo();
  const { agent } = await renderPage(ROUND, repo, { agent: true });
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  await opensWith(WEB_UI, ANSWERED);
  // Another tab takes the answers back: the round waits on you again.
  git(join(repo, ".worktrees", WEB_UI), "reset", "--quiet", "--hard", "HEAD~1");

  await click(startInComposer());

  expect(
    await screen.findByText("The feature waits on you now: there is nothing to continue."),
  ).toBeTruthy();
  expect((await composer()).textContent).toBe(ANSWERED);
  expect(agent.sent).toHaveLength(0);
});

test("US2.4: a session opened to continue a feature that waits on you says why, and fills nothing", async () => {
  const { agent } = await renderPage(`/f/${WEB_UI}/session?continue=manual`, fixtureRepo(), {
    agent: true,
  });

  expect(
    await screen.findByText("The feature waits on you now: there is nothing to continue."),
  ).toBeTruthy();
  expect((await composer()).textContent).toBe("");
  expect(agent.sent).toHaveLength(0);
});

test("the workflow's message goes before what the human typed", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: true });
  await type(await composer(), "Why A in Q6?");

  window.history.pushState(null, "", `/f/${CLI}/session?continue=manual`);
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));

  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(`${MANUAL}\nWhy A in Q6?`));
});

/** US1.2, SC-004 */
test("Commit only commits, and starts nothing", async () => {
  const { agent, repo } = await renderPage(ROUND, answeredRepo(), { agent: true });

  await click(await screen.findByRole("button", { name: "Commit only" }));

  // The round turns read-only once the commit's answer reaches the page, its buttons gone: a start
  // would have been asked for by then.
  await waitFor(() => expect(screen.queryByRole("button", { name: "Commit only" })).toBeNull());
  expect(screen.queryByRole("button", { name: "Commit and continue" })).toBeNull();
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(window.location.pathname).toBe(ROUND);
  expect(agent.sent).toHaveLength(0);
});

/** C2 */
test("C2: every commit button that leads to the agent says it starts the agent", async () => {
  await renderPage(SPEC, fixtureRepo(), { agent: true });
  expect(await screen.findByRole("button", { name: "Approve and start the agent" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Request changes and start the agent" })).toBeTruthy();
  expectNoContinue();

  window.history.replaceState(null, "", "/edit/specs/drafts/git-listener.md");
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(
    await screen.findByRole("button", { name: "Start the feature and the agent" }),
  ).toBeTruthy();
  expectNoContinue();

  window.history.replaceState(null, "", ROUND);
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(await screen.findByRole("button", { name: "Commit and start the agent" })).toBeTruthy();
  expectNoContinue();
});

function expectNoContinue() {
  const labels = screen.getAllByRole("button").map((button) => button.textContent ?? "");
  expect(labels.filter((label) => label.endsWith("and continue"))).toEqual([]);
}

/** US2.1, on a review */
test("approving a spec with Approve and start the agent opens the session with the message", async () => {
  const { agent, repo } = await renderPage(SPEC, fixtureRepo(), { agent: true });
  expect(await screen.findByRole("button", { name: "Approve only" })).toBeTruthy();

  await click(screen.getByRole("button", { name: "Approve and start the agent" }));

  await opensWith(RECURRING, /The human approved the spec\./);
  expect(git(repo, "log", "-1", "--format=%s", RECURRING).trim()).toBe(
    "spec(recurring-tasks): approve",
  );
  expect(window.location.search).toBe("?continue=approval&file=spec.md");
  expect(agent.sent).toHaveLength(0);
});

test("requesting changes with Request changes and start the agent opens the session with the message", async () => {
  const { agent, repo } = await renderPage(SPEC, fixtureRepo(), { agent: true });
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await type(await screen.findByLabelText("Comment text"), "Say more about time zones");
  await click(screen.getByRole("button", { name: "Add comment" }));

  const button = await screen.findByRole("button", {
    name: "Request changes and start the agent",
  });
  await waitFor(() => expect(button.getAttribute("aria-disabled")).not.toBe("true"));
  await click(button);

  await opensWith(RECURRING, /The human requested changes on the spec\./);
  expect(git(repo, "log", "-1", "--format=%s", RECURRING).trim()).toBe(
    "spec(recurring-tasks): request changes",
  );
  expect(agent.sent).toHaveLength(0);
});

test("committing a proposal and starting a feature open their sessions with the message", async () => {
  const repo = fixtureRepo();
  git(repo, "branch", "2026-10-14-runner", "main");
  git(repo, "worktree", "add", "--quiet", ".worktrees/2026-10-14-runner", "2026-10-14-runner");
  const proposal = join(repo, ".worktrees/2026-10-14-runner/specs/2026-10-14-runner/proposal.md");
  mkdirSync(join(proposal, ".."), { recursive: true });
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun agents.\n\n## Why\n\nSpeed.\n");
  const { agent } = await renderPage("/edit/specs/2026-10-14-runner/proposal.md", repo, {
    agent: true,
  });

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));

  await opensWith("2026-10-14-runner", /The human committed the proposal\./);
  expect(git(repo, "log", "-1", "--format=%s", "2026-10-14-runner").trim()).toBe(
    "chore(runner): proposal",
  );

  window.history.replaceState(null, "", "/edit/specs/drafts/git-listener.md");
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
  await type(await screen.findByLabelText("Slug"), "git-listener");
  expect(screen.getByRole("button", { name: "Start only" })).toBeTruthy();
  await click(screen.getByRole("button", { name: "Start the feature and the agent" }));

  const box = await opensWith("2026-10-12-git-listener", /The human started the feature\./);
  expect(box.textContent).toContain("specs/2026-10-12-git-listener/");
  expect(agent.sent).toHaveLength(0);
});

test("Start only opens the feature's page", async () => {
  await renderPage("/edit/specs/drafts/git-listener.md", fixtureRepo(), { agent: true });
  await type(await screen.findByLabelText("Slug"), "git-listener");

  await click(screen.getByRole("button", { name: "Start only" }));

  await waitFor(() => expect(window.location.pathname).toBe("/f/2026-10-12-git-listener"));
});

test("a draft's Commit keeps its single button", async () => {
  await renderPage("/edit/specs/drafts/git-listener.md", fixtureRepo(), { agent: true });

  expect(await screen.findByRole("button", { name: "Commit" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Commit and start the agent" })).toBeNull();
});

/** US1.5 */
test("Try again after a refused hook commits, then opens the session with the message", async () => {
  const repo = answeredRepo();
  const hook = refusingHook(repo);
  const { agent } = await renderPage(ROUND, repo, { agent: true });

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  expect(
    await screen.findByText(
      "The pre-commit hook refused the commit. Your answers are saved, not committed.",
    ),
  ).toBeTruthy();
  expect(window.location.pathname).toBe(ROUND);
  hook.pass();
  await click(screen.getByRole("button", { name: "Try again" }));

  await opensWith(WEB_UI, ANSWERED);
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(agent.sent).toHaveLength(0);
});

test("a refused hand-over says why in the composer, and the commit stays done", async () => {
  const repo = answeredRepo();
  const { agent, sessions } = await renderPage(ROUND, repo, { agent: true });
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  await opensWith(WEB_UI, ANSWERED);
  // Claude Code goes away after the page showed its message.
  agent.installed = false;
  await sessions.check();

  await click(startInComposer());

  expect(await screen.findByText("Claude Code is not available on this machine.")).toBeTruthy();
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect((await composer()).textContent).toBe(ANSWERED);
  expect(agent.sent).toHaveLength(0);
});
