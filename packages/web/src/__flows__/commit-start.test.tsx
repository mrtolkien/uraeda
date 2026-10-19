// Flow: the buttons that commit and hand over to the agent. Committing and starting the agent
// writes to git, then opens the feature's session with the workflow's message in the composer,
// unsent; the commit alone starts nothing; a refused hook keeps the page and offers Try again; a
// hand-over the agent refuses says why in the composer and the commit stays done. A git write shows
// at once and blocks the other writes while it runs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, startApp, type } from "./harness.tsx";
import { composer, composerText, resetAgent } from "./session-helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const RECURRING = "2026-10-06-recurring-tasks";
const PROPOSAL_FEATURE = "2026-10-14-runner";

/** The features whose round is answered but not committed, one for each test that commits it. */
const ANSWERED = ["commit", "only", "hook", "refused", "again", "blocked"].map(
  (name) => `2026-10-15-${name}`,
);

/**
 * Makes a feature on its branch with the web UI's round 01 unanswered, in a worktree where every
 * question is answered and nothing is committed, as the round page leaves it.
 */
function answeredFeature(repo: string, folder: string) {
  const source = fixture(`repo/branches/${WEB_UI}/specs/${WEB_UI}`);
  const round = readFileSync(join(source, "clarifications-01.md"), "utf8");
  git(repo, "switch", "--quiet", "--create", folder, "main");
  mkdirSync(join(repo, "specs", folder), { recursive: true });
  writeFileSync(
    join(repo, "specs", folder, "proposal.md"),
    readFileSync(join(source, "proposal.md")),
  );
  writeFileSync(join(repo, "specs", folder, "clarifications-01.md"), round);
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "work on the round");
  git(repo, "switch", "--quiet", "main");
  const worktree = join(".worktrees", folder);
  git(repo, "worktree", "add", "--quiet", worktree, folder);
  writeFileSync(
    join(repo, worktree, "specs", folder, "clarifications-01.md"),
    round.replaceAll(/^\*\*Answer:\*\*$/gm, "**Answer:** A"),
  );
}

/** A feature with a proposal committed, and one edited since in its worktree. */
function editedProposal(repo: string) {
  git(repo, "branch", PROPOSAL_FEATURE, "main");
  const worktree = join(repo, ".worktrees", PROPOSAL_FEATURE);
  git(repo, "worktree", "add", "--quiet", worktree, PROPOSAL_FEATURE);
  const proposal = join(worktree, "specs", PROPOSAL_FEATURE, "proposal.md");
  mkdirSync(join(proposal, ".."), { recursive: true });
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun.\n\n## Why\n\nSpeed.\n");
  git(worktree, "add", "--all");
  git(worktree, "commit", "--quiet", "--no-verify", "--message", "chore(runner): proposal");
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun agents.\n\n## Why\n\nSpeed.\n");
}

function repository() {
  const repo = fixtureRepo();
  for (const folder of ANSWERED) {
    answeredFeature(repo, folder);
  }
  editedProposal(repo);
  writeFileSync(
    join(repo, "specs/drafts/second.md"),
    "# Second draft\n\n## What\n\nThings.\n\n## Why\n\nSo.\n",
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: a second draft");
  return repo;
}

const app = startApp({ agent: true, repo: repository });

beforeEach(() => resetAgent(app));

/** The feature's round page. */
const roundOf = (folder: string) => `/f/${folder}/clarifications-01.md`;

/** The subject of a branch's last commit. */
function subject(branch: string) {
  return git(app.repo, "log", "-1", "--format=%s", branch).trim();
}

/** A pre-commit hook that refuses every commit until `pass` is called. */
function refusingHook() {
  const hooks = join(app.repo, ".git/hooks");
  git(app.repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused'\nexit 1\n", { mode: 0o755 });
  return () => writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
}

/** The composer's Start the agent, not the feature page's beside it. */
function startInComposer() {
  const button = screen
    .getAllByRole("button", { name: "Start the agent" })
    .find((element) => !element.closest("section"));
  expect(button, "a Start the agent in the composer").toBeTruthy();
  return button!;
}

/** Waits for the feature's session to open, and the workflow's message to fill its composer. */
async function opensWithMessage(folder: string) {
  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/f/${folder}/session`)));
  await composer();
  await waitFor(() => expect(composerText()).toMatch(/^\/uraeda /));
}

test("Commit and start the agent commits the answers, then opens the session with the message unsent", async () => {
  const folder = ANSWERED[0];
  await app.open(roundOf(folder));

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));

  await opensWithMessage(folder);
  expect(subject(folder)).toMatch(/answer round 01/);
  expect(window.location.search).toContain("continue=answers");
  expect(app.agent.sent).toHaveLength(0);
});

test("Start the agent hands over: the message goes, with the note the human added after it", async () => {
  const folder = "2026-10-15-handover";
  answeredFeature(app.repo, folder);
  await app.open(roundOf(folder));
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  await opensWithMessage(folder);

  await type(await composer(), `${composerText()}\nKeep the spec short.`);
  await click(startInComposer());

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text.endsWith("Keep the spec short.")).toBe(true);
  expect(app.agent.sent[0].text.startsWith("/uraeda ")).toBe(true);
  // The address no longer holds the message: the composer is empty, ready for a chat.
  await waitFor(() => expect(window.location.search).toBe(""));
  expect(composerText()).toBe("");
});

test("Commit only commits, and starts nothing", async () => {
  const folder = ANSWERED[1];
  await app.open(roundOf(folder));

  await click(await screen.findByRole("button", { name: "Commit only" }));

  // The round turns read-only: its commit buttons go.
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Commit/ })).toBeNull());
  expect(subject(folder)).toMatch(/answer round 01/);
  expect(window.location.pathname).toBe(app.path(roundOf(folder)));
  expect(app.agent.sent).toHaveLength(0);
});

test("a commit the hook refuses stays on the round with Try again, which commits and hands over", async () => {
  const folder = ANSWERED[2];
  const pass = refusingHook();
  await app.open(roundOf(folder));
  const before = subject(folder);

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));

  const again = await screen.findByRole("button", { name: "Try again" });
  expect(window.location.pathname).toBe(app.path(roundOf(folder)));
  expect(subject(folder)).toBe(before);
  pass();
  await click(again);

  await opensWithMessage(folder);
  expect(subject(folder)).toMatch(/answer round 01/);
  expect(app.agent.sent).toHaveLength(0);
});

test("a hand-over the agent refuses says why in the composer, and the commit stays done", async () => {
  const folder = ANSWERED[3];
  await app.open(roundOf(folder));
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  await opensWithMessage(folder);
  const message = composerText();
  // The agent goes away after the page showed its message.
  app.agent.installed = false;
  await app.sessions.check();

  await click(startInComposer());

  await waitFor(() => expect(app.agent.sent).toHaveLength(0));
  expect(composerText()).toBe(message);
  expect(subject(folder)).toMatch(/answer round 01/);
  app.agent.installed = true;
  await app.sessions.check();
});

test("a feature that waits on the human again sends the message as a chat, not as a run", async () => {
  const folder = ANSWERED[4];
  await app.open(roundOf(folder));
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  await opensWithMessage(folder);
  // Another tab takes the answers back: the round waits on the human again.
  git(join(app.repo, ".worktrees", folder), "reset", "--quiet", "--hard", "HEAD~1");

  await click(startInComposer());

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text.startsWith("/uraeda ")).toBe(false);
});

test("a session opened to continue a feature that waits on the human fills nothing", async () => {
  await app.open(`/f/${WEB_UI}/session?continue=manual`);

  // The refusal is read after the composer is drawn: until it shows, the composer offers to start
  // the agent, and its text is not yet known to stay empty.
  await waitFor(() =>
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent)).toBe(true),
  );
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
  expect((await composer()).textContent).toBe("");
  await type(await composer(), "Why A?");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].text.startsWith("/uraeda ")).toBe(false);
});

test("approving a spec with Approve and start the agent commits, then opens the session with the message", async () => {
  await app.open(`/f/${RECURRING}/spec.md`);
  await screen.findByRole("button", { name: "Approve only" });

  await click(screen.getByRole("button", { name: "Approve and start the agent" }));

  await opensWithMessage(RECURRING);
  expect(subject(RECURRING)).toMatch(/approve/);
  expect(window.location.search).toContain("continue=approval");
  expect(app.agent.sent).toHaveLength(0);
});

test("committing a feature's edited proposal commits it and opens its session with the message", async () => {
  await app.open(`/edit/specs/${PROPOSAL_FEATURE}/proposal.md`);

  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));

  await opensWithMessage(PROPOSAL_FEATURE);
  expect(subject(PROPOSAL_FEATURE)).toMatch(/proposal/);
  expect(app.agent.sent).toHaveLength(0);
});

test("starting a draft as a feature opens its session with the message, and Start only opens its page", async () => {
  await app.open("/edit/specs/drafts/git-listener.md");
  await type(await screen.findByLabelText("Slug"), "git-listener");

  await click(screen.getByRole("button", { name: "Start the feature and the agent" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(/\/f\/\d{4}-\d\d-\d\d-git-listener\/session$/),
  );
  await waitFor(() => expect(composerText()).toMatch(/^\/uraeda /));
  expect(app.agent.sent).toHaveLength(0);

  cleanup();
  await act(async () => undefined);
  await app.open("/edit/specs/drafts/second.md");
  await type(await screen.findByLabelText("Slug"), "second");
  await click(screen.getByRole("button", { name: "Start only" }));

  await waitFor(() => expect(window.location.pathname).toMatch(/\/f\/\d{4}-\d\d-\d\d-second$/));
});
