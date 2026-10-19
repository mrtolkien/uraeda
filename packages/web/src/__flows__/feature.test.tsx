// Flow: a feature's page. Its one primary action leads where the workflow waits, an agent's work
// shows with Stop, a run that ends short of a gate needs attention and opens its session, format
// notes stay folded and open again on Back, and a spec the core cannot read stops the page.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { addPlan, commitOnBranch, ELEVEN, fixture } from "uraeda-binding/test-utils";
import { startFeature } from "uraeda-binding";
import { beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, refreshUntil, startApp } from "./harness.tsx";
import { composer, composerText, resetAgent } from "./session-helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const RECURRING = "2026-10-06-recurring-tasks";
const CLI = "2026-10-12-cli-tuis";
const PLAN_REVIEW = "2026-10-13-plan-review";
const DONE = "2026-10-09-dark-mode";

/** A record of a finished feature. */
const RECORD = `---\nkind: feature\nfinished: 2026-10-11\n---\n\n# Record: Dark mode\n\n> [!NOTE]\n>\n> The record of a merged feature, not instructions to follow.\n\n## What and why\n\nA thing.\n\n## Behaviour\n\n- It works.\n\n## Design\n\nA design.\n`;

/**
 * The fixture repository with the plan review being built (its plan links a missing file, a note),
 * the recurring tasks with a mockup, and a feature merged into `main` with its record.
 */
function repository() {
  const repo = fixtureRepo();
  addPlan(repo, PLAN_REVIEW, ELEVEN);
  commitOnBranch(repo, RECURRING, {
    [`specs/${RECURRING}/mockups/repeat.html`]:
      "<!doctype html>\n<title>Mockup</title>\n<p>A.</p>\n",
  });
  git(repo, "switch", "--quiet", "--create", DONE, "main");
  mkdirSync(join(repo, "specs/done"), { recursive: true });
  writeFileSync(join(repo, `specs/done/${DONE}.md`), RECORD);
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "finish(dark-mode): dark mode");
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", DONE);
  return repo;
}

const app = startApp({ agent: true, repo: repository });

/** A feature started from its draft, in its own worktree, whose proposal links a missing file. */
let noted = "";

beforeAll(async () => {
  const { folder, worktree } = await startFeature(
    app.repo,
    "specs/drafts/git-listener.md",
    "git-listener",
  );
  const proposal = join(app.repo, worktree ?? ".", `specs/${folder}/proposal.md`);
  // A link to a missing file is a format note: it stops nothing.
  writeFileSync(proposal, `${readFileSync(proposal, "utf8")}\nSee [the notes](missing.md).\n`);
  noted = folder;
});

beforeEach(() => resetAgent(app));

/** The page's own content, without the navigation. */
function main() {
  return within(screen.getByRole("main"));
}

/** The page's primary actions: the one button that does what comes next. */
function primary() {
  return [...screen.getByRole("main").querySelectorAll<HTMLElement>('[data-variant="primary"]')];
}

/** The page's links to an address. */
function linksTo(path: string) {
  return screen
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href") === app.path(path));
}

/** Waits for the page's stages, which say it is drawn. */
async function drawn() {
  await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(screen.queryAllByRole("list").length).toBeGreaterThan(0));
}

test("a feature waiting on its answers has one primary action, which opens the round", async () => {
  await app.open(`/f/${WEB_UI}`);
  await drawn();

  const [action, ...others] = primary();
  expect(others).toHaveLength(0);
  expect(action.getAttribute("href")).toBe(app.path(`/f/${WEB_UI}/clarifications-01.md`));
  await click(action);

  expect(window.location.pathname).toBe(app.path(`/f/${WEB_UI}/clarifications-01.md`));
});

test("a spec waiting for review has one primary action, which opens the spec", async () => {
  await app.open(`/f/${RECURRING}`);
  await drawn();

  const [action, ...others] = primary();

  expect(others).toHaveLength(0);
  expect(action.getAttribute("href")).toBe(app.path(`/f/${RECURRING}/spec.md`));
});

test("a feature being built asks nothing of the human, and shows where it is among its stages", async () => {
  await app.open(`/f/${PLAN_REVIEW}`);
  await drawn();

  expect(primary()).toHaveLength(0);
  expect(document.querySelector('[aria-current="step"]')).toBeTruthy();
  // Its workflow files are listed, each a link to its page in the UI.
  expect(linksTo(`/f/${PLAN_REVIEW}/plan.md`).length).toBeGreaterThan(0);
});

test("the page links the mockups of the feature", async () => {
  await app.open(`/f/${RECURRING}`);
  await drawn();

  expect(linksTo(`/f/${RECURRING}/mockups/repeat.html`).length).toBeGreaterThan(0);
});

/** The fold of the page's format notes: the one button of the page that opens and closes. */
function fold() {
  return main()
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-expanded") !== null)!;
}

test("format notes are folded, block nothing, and are open again on Back", async () => {
  await app.open(`/f/${noted}`);
  await drawn();
  await waitFor(() => expect(fold()).toBeTruthy());
  expect(fold().getAttribute("aria-expanded")).toBe("false");
  // A note is no problem: the page is not the one of a feature that cannot go on.
  expect(primary()).toHaveLength(0);

  await click(fold());
  expect(fold().getAttribute("aria-expanded")).toBe("true");
  await click(linksTo(`/f/${noted}/proposal.md`)[0]);
  expect(window.location.pathname).toBe(app.path(`/f/${noted}/proposal.md`));
  await act(async () => window.history.back());

  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/f/${noted}`)));
  await waitFor(() => expect(fold().getAttribute("aria-expanded")).toBe("true"));
});

/** A turn of the agent on the feature's session, going until the test ends it. */
async function liveRun(folder: string) {
  const session = await app.sessions.featureSession(app.repo, folder);
  const { turn } = await app.sessions.send(app.repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  app.agent.emit({ id: app.agent.sent[0].id, type: "accepted" });
  return turn;
}

/** The link to the feature's session. */
function sessionLink(folder: string) {
  return screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("href") === app.path(`/f/${folder}/session`));
}

test("a working agent shows Stop, and Stop interrupts it; the stopped run needs attention", async () => {
  await liveRun(CLI);
  await app.open(`/f/${CLI}`);
  await drawn();

  const stop = await screen.findByRole("button", { name: "Stop" });
  await click(stop);

  await waitFor(() => expect(app.agent.interrupts).toBe(1));
  await refreshUntil(() => expect(screen.queryByRole("button", { name: "Stop" })).toBeNull());
  // The run ended short of a gate: the session opens, with nothing filled in for the human.
  await click(sessionLink(CLI)!);
  expect(window.location.pathname).toBe(app.path(`/f/${CLI}/session`));
  expect(window.location.search).toBe("");
  await composer();
  expect(composerText()).toBe("");
  expect(app.agent.sent).toHaveLength(1);
});

test("a failed run needs attention, and its session opens unfilled", async () => {
  app.agent.script([
    { denials: [], errors: ["Rate limit reached"], interrupted: false, ok: false, type: "result" },
  ]);
  const session = await app.sessions.featureSession(app.repo, CLI);
  const { turn } = await app.sessions.send(app.repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await app.sessions.settled(turn);
  await app.open(`/f/${CLI}`);
  await drawn();

  await waitFor(() => expect(sessionLink(CLI)).toBeTruthy());
  await click(sessionLink(CLI)!);

  expect(window.location.search).toBe("");
  await composer();
  expect(composerText()).toBe("");
});

test("a merged feature shows its record, with nothing for the human to do", async () => {
  await app.open(`/f/${DONE}`);
  await drawn();

  expect(primary()).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
});

test("a spec whose status the core cannot read stops the page, with the file to fix", async () => {
  const spec = `specs/${RECURRING}/spec.md`;
  const text = readFileSync(fixture(`repo/branches/${RECURRING}/${spec}`), "utf8");
  commitOnBranch(app.repo, RECURRING, {
    [spec]: text.replace("status: awaiting-human", "status: aproved"),
  });
  await app.open(`/f/${RECURRING}`);
  await drawn();

  // Nothing can go on: no action but the link to the file that has the problem.
  await waitFor(() => expect(primary()).toHaveLength(0));
  expect(linksTo(`/f/${RECURRING}/spec.md`).length).toBeGreaterThan(0);
});
