// The page of a feature or a change: its stages and their times, "Next" beside the agent, its files,
// its blocking problems, and its notes, folded. Times are read in UTC (`vite.config.ts`).
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { refreshPullRequests, startFeature } from "uraeda-binding";
import {
  addChange,
  addPlan,
  commitOnBranch,
  commitsAt,
  ELEVEN,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { COLUMN_KEY } from "../layout/documentColumnWidth.ts";
import { navigate } from "../routes.tsx";
import {
  addMockup,
  atRepo,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  git,
  record,
  refreshUntil,
  renderPage,
  today,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";
const RECURRING = "2026-10-06-recurring-tasks";
const CHANGE = "2026-10-16-header-logo";
const DONE = "2026-10-09-dark-mode";

today("2026-10-12");

type Steps = Parameters<Fake["adapter"]["script"]>[0];

/** The page's "Next", once drawn. */
async function nextCard() {
  return within(await screen.findByRole("region", { name: "Next" }));
}

/** The sessions' pane, in the Home's column. */
function sessionsCard() {
  return within(screen.getByRole("region", { name: "Sessions" }));
}

/** The stages' list. */
function stages() {
  return within(screen.getByRole("list", { name: "Stages" }));
}

/** The stage of this label. */
function stage(label: string) {
  const item = stages()
    .getAllByRole("listitem")
    .find((li) => within(li).queryAllByText(label, { exact: true }).length > 0);
  if (!item) {
    throw new Error(`No stage ${label}`);
  }
  return item;
}

/** What a stage shows: its time, its files, and its tasks. */
function stageLine(label: string) {
  return stage(label).textContent ?? "";
}

/** The label of the current stage. */
function currentStage() {
  const item = stages().queryByRole("listitem", { current: "step" });
  if (!item) {
    return undefined;
  }
  return ["Proposal", "Questions", "Spec", "Plan", "Build", "Fix", "Pull request", "Merged"].find(
    (label) => within(item).queryAllByText(label, { exact: true }).length > 0,
  );
}

/** A feature merged into `main` with a merge commit, its record on the default branch. */
function doneFeature(repo: string) {
  git(repo, "switch", "--quiet", "--create", DONE, "main");
  mkdirSync(join(repo, "specs/done"), { recursive: true });
  writeFileSync(join(repo, `specs/done/${DONE}.md`), record("Dark mode"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "finish(dark-mode): dark mode");
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", DONE);
}

/**
 * A `gh` on the PATH that lists `pulls` as the open pull requests, read once into the binding's
 * snapshot of `repo`, as `crates/cli/tests/next.rs` fakes it: the server reads the real binding.
 */
async function fakeGh(repo: string, pulls: Array<Record<string, unknown>>) {
  const bin = temporaryFolder("uraeda-gh");
  const gh = join(bin, "gh");
  writeFileSync(gh, `#!/bin/sh\necho '${JSON.stringify(pulls)}'\n`);
  chmodSync(gh, 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path ?? ""}`;
  onTestFinished(() => {
    process.env.PATH = path;
  });
  await refreshPullRequests(repo);
}

/** US1.1 */
test("a build says the agent is building, with its task and Open the session", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  const fake = await fakeAgent();
  await liveRun(fake, repo);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "The agent is building" })).toBeTruthy();
  expect(next.getByText("Task 7 of 11: Session column")).toBeTruthy();
  expect(next.queryByRole("button")).toBeNull();
  expect(next.getByRole("link", { name: "Open the session" }).getAttribute("href")).toBe(
    atRepo(`/f/${CLI}/session`),
  );
  expect(currentStage()).toBe("Build");
});

/** US1.2 */
test("a spec waiting for you says so, with its one button", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "You review the spec" })).toBeTruthy();
  expect(next.getByText("Spec to review, about 25 minutes.")).toBeTruthy();
  expect(next.getAllByRole("link")).toHaveLength(1);
  expect(next.getByRole("link", { name: "Review the spec" }).getAttribute("href")).toBe(
    atRepo(`/f/${RECURRING}/spec.md`),
  );
  expect(currentStage()).toBe("Spec");
});

/** US1.3 */
test("a passed stage shows its time and duration", async () => {
  const repo = fixtureRepo();
  commitsAt(repo, CLI, [
    { at: "2026-10-17T12:11:00Z", files: { "notes/spec.txt": "1" }, message: "spec(cli-tuis): x" },
    {
      at: "2026-10-17T15:01:00Z",
      files: { "notes/approve.txt": "1" },
      message: "approve(cli-tuis): x",
    },
    {
      at: "2026-10-17T15:01:30Z",
      files: { "notes/decision.txt": "1" },
      message: "decision(cli-tuis): x",
    },
    // A plan written after the approval's decisions: the Spec stage ends at the decisions (R4).
    { at: "2026-10-17T15:08:00Z", files: { "notes/plan.txt": "1" }, message: "plan(cli-tuis): x" },
  ]);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  await nextCard();
  expect(stageLine("Spec")).toContain("12:11 · 2 h 50 min");
  expect(currentStage()).toBe("Plan");
  expect(stageLine("Plan")).toContain("since 15:01");
});

/** US1 more 1 */
test("two rounds of questions read as such", async () => {
  const repo = fixtureRepo();
  const round = readFileSync(
    join(
      import.meta.dirname,
      "../../../../fixtures/repo/branches",
      CLI,
      "specs",
      CLI,
      "clarifications-01.md",
    ),
    "utf8",
  );
  commitsAt(repo, CLI, [
    {
      at: "2026-10-12T10:00:00Z",
      files: { [`specs/${CLI}/discovery-01.md`]: "# Discovery\n" },
      message: "discovery(cli-tuis): x",
    },
    {
      at: "2026-10-12T11:00:00Z",
      files: { [`specs/${CLI}/clarifications-02.md`]: round.replace("round 01", "round 02") },
      message: "discovery(cli-tuis): round 2",
    },
  ]);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  await nextCard();
  expect(stageLine("Questions")).toContain("2 rounds");
});

/** US1 more 2, review focus 10 */
test("a build started the next day shows its date", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  commitsAt(repo, CLI, [
    { at: "2026-10-17T15:08:00Z", files: { "notes/plan.txt": "1" }, message: "plan(cli-tuis): x" },
    { at: "2026-10-18T09:10:00Z", files: { "src/a.ts": "1" }, message: "feat(cli-tuis): x" },
  ]);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  await nextCard();
  expect(stageLine("Plan")).toContain("15:08 · 18 h 02 min");
  expect(stageLine("Build")).toContain("Oct 18, 09:10");
});

/** C1: the header gives the folder's day, so the first stage shows its date on another day. */
test("a first stage started after the folder's day shows its date", async () => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, { "proposal.md": "# A home logo\n" });
  commitsAt(repo, `change/${CHANGE}`, [
    {
      at: "2026-10-17T09:10:00Z",
      files: { [`specs/changes/${CHANGE}/proposal.md`]: "# A home logo\n\nIn the header.\n" },
      message: "proposal(header-logo): x",
    },
  ]);

  await renderPage(`/f/${CHANGE}`, repo, { agent: true });

  await nextCard();
  expect(stageLine("Proposal")).toContain("Oct 17, 09:10");
});

/** US1 more 3 */
test("a feature without a session lists none, and offers New session", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });

  await nextCard();
  const card = sessionsCard();
  expect(card.getByText("No session yet.")).toBeTruthy();
  expect(card.queryByRole("link")).toBeNull();
  expect(card.getByRole("button", { name: "New session" })).toBeTruthy();
});

/** US3.1 */
test("a change opens its page, with Fix marked and the session one click away", async () => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, { "proposal.md": "# A home logo\n" });

  await renderPage(`/f/${CHANGE}`, repo, { agent: true });

  expect(await screen.findByRole("heading", { level: 1, name: "A home logo" })).toBeTruthy();
  expect(currentStage()).toBe("Fix");
  expect(screen.queryByRole("log", { name: "Conversation" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "New session" })).toHaveLength(1);
});

/** US5.1, the page */
test("an open pull request's Next only opens it", async () => {
  const repo = fixtureRepo();
  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );
  const url = "https://github.com/o/r/pull/31";
  await fakeGh(repo, [{ headRefName: CLI, isDraft: false, number: 31, reviewDecision: "", url }]);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "Your review on pull request #31" })).toBeTruthy();
  expect(next.getAllByRole("link")).toHaveLength(1);
  expect(next.queryByRole("button")).toBeNull();
  expect(next.getByRole("link", { name: "Open pull request #31" }).getAttribute("href")).toBe(url);
});

/** The pull request opens in a new tab from "Next" and from the page's links, as external links do. */
test("the pull request opens in a new tab from Next and from the links", async () => {
  const repo = fixtureRepo();
  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );
  const url = "https://github.com/o/r/pull/31";
  await fakeGh(repo, [{ headRefName: CLI, isDraft: false, number: 31, reviewDecision: "", url }]);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  const next = (await nextCard()).getByRole("link", { name: "Open pull request #31" });
  const links = within(screen.getByRole("region", { name: "Links" }));
  const row = links.getByRole("link", { name: "Pull request #31" });
  for (const link of [next, row]) {
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  }
});

/** Whether `first` comes before `second` in the page. */
function before(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/** US6.2, the page; edge case: invalid status */
test("a spec whose status cannot be read stops the page", async () => {
  const repo = fixtureRepo();
  const path = join("fixtures/repo/branches", RECURRING, "specs", RECURRING, "spec.md");
  const spec = readFileSync(join(import.meta.dirname, "../../../..", path), "utf8");
  commitOnBranch(repo, RECURRING, {
    [`specs/${RECURRING}/spec.md`]: spec.replace("status: awaiting-human", "status: aproved"),
  });

  await renderPage(`/f/${RECURRING}`, repo, { agent: true });

  expect(await screen.findByText("This feature cannot go on")).toBeTruthy();
  expect(screen.getByText("spec.md:2")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open spec.md" }).getAttribute("href")).toBe(
    atRepo(`/f/${RECURRING}/spec.md`),
  );
  const next = await nextCard();
  expect(next.getByRole("heading", { name: "Nothing can go on" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /format note/ })).toBeNull();
  // The banner says it before Next does.
  expect(
    before(
      screen.getByText("This feature cannot go on"),
      screen.getByRole("region", { name: "Next" }),
    ),
  ).toBe(true);
});

/** US6.2, the page: a change names itself */
test("a change whose round cannot be read says the change cannot go on", async () => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, {
    "clarifications-01.md": "---\nstatus: aproved\n---\n\n# Questions\n",
    "proposal.md": "# A home logo\n",
  });

  await renderPage(`/f/${CHANGE}`, repo, { agent: true });

  expect(await screen.findByText("This change cannot go on")).toBeTruthy();
  expect(screen.queryByText("This feature cannot go on")).toBeNull();
});

/** US6.1, the page */
test("format notes are folded at the bottom", async () => {
  const repo = fixtureRepo();
  // A feature started from its draft passes the core's checks; a link to a missing file is a note.
  const { folder, worktree } = await startFeature(
    repo,
    "specs/drafts/git-listener.md",
    "git-listener",
  );
  const proposal = join(repo, worktree ?? ".", `specs/${folder}/proposal.md`);
  writeFileSync(proposal, `${readFileSync(proposal, "utf8")}\nSee [the notes](missing.md).\n`);

  await renderPage(`/f/${folder}`, repo, { agent: true });

  const notes = await screen.findByRole("button", { name: "Format notes · 1" });
  expect(notes.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("This feature cannot go on")).toBeNull();
  // Under the panes: after Next and the timeline.
  expect(before(screen.getByRole("list", { name: "Stages" }), notes)).toBe(true);
  await click(notes);
  expect(
    screen.getByText("They block nothing: the next agent step rewrites what drifted."),
  ).toBeTruthy();
  expect(screen.getByText(/^proposal\.md:\d+$/)).toBeTruthy();
});

/** The ui-behaviour decision: Back restores the items opened, the notes' fold among them. */
test("the format notes opened are open again on Back", async () => {
  const repo = fixtureRepo();
  const { folder, worktree } = await startFeature(
    repo,
    "specs/drafts/git-listener.md",
    "git-listener",
  );
  const proposal = join(repo, worktree ?? ".", `specs/${folder}/proposal.md`);
  writeFileSync(proposal, `${readFileSync(proposal, "utf8")}\nSee [the notes](missing.md).\n`);
  await renderPage(`/f/${folder}`, repo, { agent: true });
  await click(await screen.findByRole("button", { name: "Format notes · 1" }));

  await act(async () => navigate(atRepo(`/f/${folder}/proposal.md`)));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Format notes · 1" })).toBeNull(),
  );
  await act(async () => window.history.back());

  const notes = await screen.findByRole("button", { name: "Format notes · 1" });
  expect(notes.getAttribute("aria-expanded")).toBe("true");
});

/** SC-003 */
test.each([
  ["a feature waiting on you", WEB_UI],
  ["a spec to review", RECURRING],
  ["a change", CHANGE],
  ["a done feature", DONE],
])("%s has exactly one New session", async (_, folder) => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, { "proposal.md": "# A home logo\n" });
  doneFeature(repo);

  await renderPage(`/f/${folder}`, repo, { agent: true });

  await nextCard();
  expect(screen.getAllByRole("button", { name: "New session" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Review and start the agent" })).toBeNull();
});

test("without the agent, its card says so", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: await fakeAgent({ installed: false }) });

  await nextCard();
  expect(sessionsCard().getByText("Claude Code is not available on this machine.")).toBeTruthy();
});

/** US2.1 */
test("an idle agent offers the recommended message as Continue", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "The agent writes the plan" })).toBeTruthy();
  expect(await next.findByRole("button", { name: "Continue, write the plan" })).toBeTruthy();
  expect(next.queryByRole("link")).toBeNull();
});

test("an unknown pull request state says so", async () => {
  const repo = fixtureRepo();
  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "Pull request state unknown" })).toBeTruthy();
  expect(next.queryByRole("link")).toBeNull();
});

/** US2.6, kept from the old page */
test("a merged feature still says to run ura clean", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);
  git(repo, "worktree", "add", "--quiet", `.worktrees/${DONE}`, DONE);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  expect(await screen.findByRole("heading", { level: 1, name: "Dark mode" })).toBeTruthy();
  expect(screen.getByText("Worktree and branch left")).toBeTruthy();
  expect(screen.getByText(`.worktrees/${DONE}`)).toBeTruthy();
  const next = await nextCard();
  expect(
    before(
      screen.getByText("Worktree and branch left"),
      screen.getByRole("region", { name: "Next" }),
    ),
  ).toBe(true);
  expect(next.getByRole("heading", { name: "Merged" })).toBeTruthy();
  expect(within(stage("Merged")).getByRole("link", { name: "Record" })).toBeTruthy();
  expect(currentStage()).toBeUndefined();
});

/** US1.2 */
test("Questions shows its time, its round, and links its files", async () => {
  const repo = fixtureRepo();
  commitsAt(repo, RECURRING, [
    {
      at: "2026-10-06T09:32:00Z",
      files: { [`specs/${RECURRING}/discovery-01.md`]: "# Discovery\n" },
      message: "discovery(recurring-tasks): x",
    },
    {
      at: "2026-10-06T12:42:00Z",
      files: { "notes/spec.txt": "1" },
      message: "spec(recurring-tasks): x",
    },
  ]);

  await renderPage(`/f/${RECURRING}`, repo, { agent: true });

  await nextCard();
  const questions = within(stage("Questions"));
  expect(stageLine("Questions")).toContain("09:32 · 3 h 10 min · 1 round");
  expect(questions.getByRole("link", { name: "Discovery 01" }).getAttribute("href")).toBe(
    atRepo(`/f/${RECURRING}/discovery-01.md`),
  );
  expect(questions.getByRole("link", { name: "Questions 01" }).getAttribute("href")).toBe(
    atRepo(`/f/${RECURRING}/clarifications-01.md`),
  );
  expect(stageLine("Questions")).toContain("answered");
});

/** US1.2 */
test("Build is current with its tasks", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  const fake = await fakeAgent();
  await liveRun(fake, repo);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await nextCard();
  expect(currentStage()).toBe("Build");
  const build = within(stage("Build"));
  expect(build.getByText(/Tasks 1–6/)).toBeTruthy();
  expect(build.getByText(/7 Session column/)).toBeTruthy();
  expect(build.getByText(/Tasks 8–11/)).toBeTruthy();
  // A stage not reached shows its name only.
  expect(stageLine("Merged")).not.toContain("since");
  expect(within(stage("Merged")).queryByRole("link")).toBeNull();
});

/** US1.3 */
test("a file waiting on you reads to review", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });

  await nextCard();
  const spec = within(stage("Spec"));
  expect(spec.getByRole("link", { name: "Spec" })).toBeTruthy();
  expect(stageLine("Spec")).toContain("to review");
  expect(stageLine("Questions")).not.toContain("to review");
  expect(currentStage()).toBe("Spec");
});

/** US1 more 3 */
test("a change's stages are Proposal, Questions, Fix, Pull request, Merged, and Rulings sits in Fix", async () => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, {
    "clarifications-01.md": "---\nstatus: answered\n---\n\n# Questions\n",
    "proposal.md": "# A home logo\n",
    "rulings.md": "# Rulings\n",
  });

  await renderPage(`/f/${CHANGE}`, repo, { agent: true });

  await nextCard();
  const labels = stages()
    .getAllByRole("listitem")
    .map((item) => item.textContent?.match(/Proposal|Questions|Fix|Pull request|Merged/)?.[0]);
  expect(labels).toEqual(["Proposal", "Questions", "Fix", "Pull request", "Merged"]);
  expect(within(stage("Fix")).getByRole("link", { name: "Rulings" })).toBeTruthy();
  expect(within(stage("Questions")).getByRole("link", { name: "Questions 01" })).toBeTruthy();
});

/** SC-001 */
test("every file of the folder shows once", async () => {
  const repo = fixtureRepo();
  addMockup(repo, RECURRING, "repeat.html");

  await renderPage(`/f/${RECURRING}`, repo, { agent: true });

  await nextCard();
  const shown = within(screen.getByRole("list", { name: "Stages" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
  expect(shown.toSorted()).toEqual(
    ["proposal.md", "clarifications-01.md", "spec.md", "mockups/repeat.html"]
      .map((name) => atRepo(`/f/${RECURRING}/${name}`))
      .toSorted(),
  );
});

test("the header names the kind, the day, and the branch", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  expect(await screen.findByText(`Feature · Oct 12 · branch ${CLI}`)).toBeTruthy();
});

/** Review comment C1 of the old page: the mockups beside the files, now in the timeline's Spec. */
test("the page links its mockups", async () => {
  const repo = fixtureRepo();
  addMockup(repo, RECURRING, "repeat.html");

  await renderPage(`/f/${RECURRING}`, repo);

  await nextCard();
  const link = within(stage("Spec")).getByRole("link", { name: /repeat\.html/ });
  expect(link.getAttribute("href")).toBe(atRepo(`/f/${RECURRING}/mockups/repeat.html`));
});

test("a file page shows breadcrumbs", async () => {
  await renderPage(`/f/${RECURRING}/proposal.md`);

  const crumbs = await screen.findByRole("navigation", { name: "Breadcrumbs" });
  expect(within(crumbs).getByRole("link", { name: "Home" })).toBeTruthy();
  expect(within(crumbs).getByRole("link", { name: "Recurring tasks" })).toBeTruthy();
  expect(within(crumbs).getByText("proposal.md")).toBeTruthy();
});

// The agent's card, moved from the old agent panel's tests.

/** Sends the workflow's message to a feature's session, as the composer's "Start the agent" does. */
async function startTurn(fake: Fake, repo: string, folder: string) {
  const session = await fake.sessions.featureSession(repo, folder);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  return turn;
}

/** Scripts a turn of the fake agent, starts it as the composer does, and waits for its end. */
async function seedRun(fake: Fake, repo: string, folder: string, steps: Steps) {
  fake.adapter.script(steps);
  const id = await startTurn(fake, repo, folder);
  await fake.sessions.settled(id);
  return id;
}

/** Starts a turn that goes on until the test ends it, with its events sent by `agent.emit`. */
async function liveRun(fake: Fake, repo: string, folder = CLI) {
  const id = await startTurn(fake, repo, folder);
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  return id;
}

/** Waits for the feature's session to open, its composer empty. */
async function opensEmpty(folder: string) {
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${folder}/session`)));
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  expect(box.textContent).toBe("");
}

/** US1, US2 of the session */
test("a run that ends before a human gate needs attention, and opens its session unfilled", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // The fake agent commits nothing: the plan step still waits on the agent.
  await seedRun(fake, repo, CLI, [{ text: "Planned.", type: "text" }]);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await waitFor(() =>
    expect(sessionsCard().getByRole("img", { name: "Needs attention" })).toBeTruthy(),
  );
  expect(sessionsCard().getByText(/^Last run: Plan · done · /)).toBeTruthy();
  await click(sessionsCard().getByRole("link", { name: / \d\d:\d\d$/ }));

  await opensEmpty(CLI);
  expect(await screen.findByText("The agent stopped before a human gate.")).toBeTruthy();
});

// US1 of merge chats: the word "chat" leaves the UI; a turn the human sent is a message.
test("a session's last run sent by the human reads as a message", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  fake.adapter.script([{ text: "Read.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, session.id, { text: "Read the plan." });
  await fake.sessions.settled(turn);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await waitFor(() => expect(sessionsCard().getByText(/^Last run: Message · done/)).toBeTruthy());
  expect(sessionsCard().queryByText(/Chat/)).toBeNull();
});

test("a working agent shows Working, Stop, and its run, and Stop stops it", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(sessionsCard().getByRole("img", { name: "Working" })).toBeTruthy());
  // A turn runs: "Next" no longer says the session starts it.
  expect(
    (await nextCard()).queryByText("The agent takes it from here: open the session to start it."),
  ).toBeNull();

  await click(sessionsCard().getByRole("button", { name: "Stop" }));

  await waitFor(() => expect(agent.interrupts).toBe(1));
  await refreshUntil(() =>
    expect(sessionsCard().getByText(/^Last run: Plan · stopped/)).toBeTruthy(),
  );
  expect(sessionsCard().getByRole("img", { name: "Needs attention" })).toBeTruthy();
  await click(sessionsCard().getByRole("link", { name: / \d\d:\d\d$/ }));

  await opensEmpty(CLI);
  expect(await screen.findByText("You stopped the agent.")).toBeTruthy();
  expect(agent.sent).toHaveLength(1);
});

test("a Stop that fails says why in the card", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(sessionsCard().getByRole("img", { name: "Working" })).toBeTruthy());
  vi.spyOn(fake.sessions, "stop").mockImplementation(() => {
    throw new Error("refused: The agent did not take the interrupt.");
  });

  await click(sessionsCard().getByRole("button", { name: "Stop" }));

  expect(await sessionsCard().findByText("The agent did not take the interrupt.")).toBeTruthy();
});

test("a failed run needs attention, and opens its session unfilled", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    { denials: [], errors: ["Rate limit reached"], interrupted: false, ok: false, type: "result" },
  ]);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(sessionsCard().getByText(/^Last run: Plan · failed/)).toBeTruthy());
  expect(sessionsCard().getByRole("img", { name: "Needs attention" })).toBeTruthy();

  await click(sessionsCard().getByRole("link", { name: / \d\d:\d\d$/ }));

  await opensEmpty(CLI);
  expect(await screen.findByText("The agent's run failed.")).toBeTruthy();
  expect(agent.sent).toHaveLength(1);
});

/** US2.7 of the session */
test("Home shows a working agent", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // A feature started from its draft, whose worktree passes the core's checks.
  const { folder } = await startFeature(repo, "specs/drafts/git-listener.md", "git-listener");
  await startTurn(fake, repo, folder);

  await renderPage("/", repo, { agent: fake });

  const main = within(await screen.findByRole("main"));
  const progress = within(await main.findByRole("region", { name: "In progress" }));
  const row = await progress.findByRole("link", { name: /^Git listener process/ });
  // Its step on its second line, and its session's status at its end, read in its name.
  expect(within(row).getByText(/^Discovery/)).toBeTruthy();
  expect(row.getAttribute("aria-label")).toMatch(/, Working$/);
});

test("a merged feature's session opens from its card, with its last run and no Stop", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, DONE);
  const id = fake.sessions.cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "finish",
    trigger: "manual",
  });
  fake.sessions.cache.appendItem(id, { kind: "text", streaming: false, text: "Finished." });
  fake.sessions.cache.endTurn(id, { state: "done" });

  await renderPage(`/f/${DONE}`, repo, { agent: fake });

  await nextCard();
  expect(
    await sessionsCard().findByText(/^Last run: Finishing, draft pull request · done/),
  ).toBeTruthy();
  expect(sessionsCard().getByRole("link", { name: / \d\d:\d\d$/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
});

/** A turn of the feature's session, started at `at` and ended at `ended`, or still running. */
async function turnAt(fake: Fake, repo: string, at: string, ended: string | null) {
  const { cache } = fake.sessions;
  const session = await fake.sessions.featureSession(repo, CLI);
  const id = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "implementation",
    trigger: "manual",
  });
  if (ended !== null) {
    cache.endTurn(id, { state: "done" });
  }
  cache.db.prepare("UPDATE turns SET started_at = ?, ended_at = ? WHERE id = ?").run(at, ended, id);
}

/** The figures' pane in the Home's column, and its row of this name. */
function produced(label: string): HTMLElement {
  const pane = screen.getByRole("region", { name: "Produced so far" });
  return within(pane).getByRole("group", { name: label });
}

/** The feature started at 09:12, the browser's clock at `now`. */
function startedAt0912(repo: string, now: string) {
  commitsAt(repo, CLI, [
    {
      at: "2026-10-12T09:12:00Z",
      files: { [`specs/${CLI}/proposal.md`]: "# Proposal: CLI TUIs\n" },
      message: "proposal(cli-tuis): x",
    },
  ]);
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date(now));
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** US3.1 */
test("Produced so far reads agent time and elapsed", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await turnAt(fake, repo, "2026-10-12T09:14:00.000Z", "2026-10-12T10:06:00.000Z");
  await turnAt(fake, repo, "2026-10-12T13:15:00.000Z", "2026-10-12T15:14:00.000Z");
  startedAt0912(repo, "2026-10-12T15:14:00Z");

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await screen.findByRole("region", { name: "Produced so far" });
  expect(produced("agent time").textContent).toContain("2 h 51 min");
  expect(produced("elapsed").textContent).toContain("6 h 02 min");
});

/** US3 more 1 */
test("agent time grows while a turn runs", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await turnAt(fake, repo, "2026-10-12T15:10:00.000Z", null);
  startedAt0912(repo, "2026-10-12T15:14:00Z");

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await screen.findByRole("region", { name: "Produced so far" });
  expect(produced("agent time").textContent).toContain("4 min");
  await act(async () => {
    vi.setSystemTime(new Date("2026-10-12T15:15:00Z"));
    vi.advanceTimersByTime(30_000);
  });
  expect(produced("agent time").textContent).toContain("5 min");
});

/** US3 more 2 */
test("agent time reads Not recorded without a turn", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${CLI}`, repo, { agent: true });

  await screen.findByRole("region", { name: "Produced so far" });
  expect(produced("agent time").textContent).toContain("Not recorded");
  expect(produced("tokens").textContent).toContain("Not recorded");
});

/** US1 more 2, and the documents' column's width and fold, which this column shares */
test("] folds the Home's column and the width is the documents'", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${CLI}`, repo, { agent: true });
  await screen.findByRole("region", { name: "Produced so far" });
  expect(screen.getByRole("separator", { name: "Resize the feature's column" })).toBeTruthy();

  fireEvent.keyDown(document.body, { key: "]" });

  await waitFor(() => expect(screen.queryByRole("region", { name: "Sessions" })).toBeNull());
  expect(screen.queryByRole("region", { name: "Produced so far" })).toBeNull();
  expect(JSON.parse(window.localStorage.getItem(COLUMN_KEY) ?? "{}")).toMatchObject({
    folded: true,
  });
  await click(screen.getByRole("button", { name: "Show the feature's column" }));
  expect(await screen.findByRole("region", { name: "Sessions" })).toBeTruthy();
});

/** US1 more 2: the folded column is the documents' column's fold */
test("a column folded for the documents is folded on the Home", async () => {
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ folded: true }));
  const repo = fixtureRepo();
  await renderPage(`/f/${CLI}`, repo, { agent: true });

  await screen.findByRole("heading", { level: 1 });
  expect(screen.queryByRole("region", { name: "Sessions" })).toBeNull();
});

/** US5.1, the Home's */
test("no page of the feature links Storybook", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${CLI}`, repo, { agent: true });

  await screen.findByRole("region", { name: "Sessions" });
  expect(screen.queryByRole("link", { name: /Storybook/ })).toBeNull();
});
