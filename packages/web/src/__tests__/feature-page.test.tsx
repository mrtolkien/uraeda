// The page of a feature or a change: its stages and their times, "Next" beside the agent, its files,
// its blocking problems, and its notes, folded. Times are read in UTC (`vite.config.ts`).
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
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

/** The agent's card. */
function agentCard() {
  return within(screen.getByRole("region", { name: "Agent" }));
}

/** The stages' list. */
function stages() {
  return within(screen.getByRole("list", { name: "Stages" }));
}

/** The texts a stage shows, without its label and the word read out for a passed one. */
function stageTexts(item: HTMLElement, label: string) {
  return within(item)
    .getAllByText(/./)
    .map((element) => element.textContent ?? "")
    .filter((text) => text !== label && text !== "completed");
}

/** The stage of this label. */
function stage(label: string) {
  const item = stages()
    .getAllByRole("listitem")
    .find((li) => within(li).queryByText(label, { exact: true }));
  if (!item) {
    throw new Error(`No stage ${label}`);
  }
  return item;
}

/** A stage's line: its time and duration, or since when, its no-break spaces read as spaces. */
function stageLine(label: string) {
  return stageTexts(stage(label), label).join(" ").replaceAll("\u00a0", " ");
}

/** The label of the current stage. */
function currentStage() {
  const item = stages().queryByRole("listitem", { current: "step" });
  if (!item) {
    return undefined;
  }
  return within(item)
    .getAllByText(/./)
    .map((element) => element.textContent)
    .find((text) =>
      ["Proposal", "Questions", "Spec", "Plan", "Build", "Fix", "Pull request", "Merged"].includes(
        text ?? "",
      ),
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
test("a feature being built says the agent is building, with no button", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "The agent is building" })).toBeTruthy();
  expect(next.getByText("Task 7 of 11: Session column")).toBeTruthy();
  expect(next.queryByRole("button")).toBeNull();
  expect(next.queryByRole("link")).toBeNull();
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
  expect(stageLine("Spec")).toBe("12:11 · 2 h 50 min");
  expect(currentStage()).toBe("Plan");
  expect(stageLine("Plan")).toBe("since 15:01");
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
  expect(stageLine("Plan")).toBe("15:08 · 18 h 2 min");
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
  expect(stageLine("Proposal")).toBe("Oct 17, 09:10");
});

/** US1 more 3 */
test("an idle agent reads Idle", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });

  await nextCard();
  const agent = agentCard();
  expect(agent.getByText("Idle")).toBeTruthy();
  expect(agent.queryByRole("heading")).toBeNull();
  expect(agent.getByRole("link", { name: "Open the session" }).getAttribute("href")).toBe(
    atRepo(`/f/${RECURRING}/session`),
  );
});

/** US3.1 */
test("a change opens its page, with Fix marked and the session one click away", async () => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, { "proposal.md": "# A home logo\n" });

  await renderPage(`/f/${CHANGE}`, repo, { agent: true });

  expect(await screen.findByRole("heading", { level: 1, name: "A home logo" })).toBeTruthy();
  expect(currentStage()).toBe("Fix");
  expect(screen.queryByRole("log", { name: "Conversation" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Open the session" })).toHaveLength(1);
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
  const links = within(screen.getByRole("list", { name: "Links" }));
  const row = links.getByRole("link", { name: /Pull request #31/ });
  for (const link of [next, row]) {
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  }
});

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

  const notes = await screen.findByRole("button", { name: "1 format note" });
  expect(notes.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("This feature cannot go on")).toBeNull();
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
  await click(await screen.findByRole("button", { name: "1 format note" }));

  await act(async () => navigate(atRepo(`/f/${folder}/proposal.md`)));
  await waitFor(() => expect(screen.queryByRole("button", { name: "1 format note" })).toBeNull());
  await act(async () => window.history.back());

  const notes = await screen.findByRole("button", { name: "1 format note" });
  expect(notes.getAttribute("aria-expanded")).toBe("true");
});

/** SC-003 */
test.each([
  ["a feature waiting on you", WEB_UI],
  ["a spec to review", RECURRING],
  ["a change", CHANGE],
  ["a done feature", DONE],
])("%s has exactly one Open the session", async (_, folder) => {
  const repo = fixtureRepo();
  addChange(repo, CHANGE, { "proposal.md": "# A home logo\n" });
  doneFeature(repo);

  await renderPage(`/f/${folder}`, repo, { agent: true });

  await nextCard();
  expect(screen.getAllByRole("link", { name: "Open the session" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Review and start the agent" })).toBeNull();
});

test("without the agent, its card says so", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: await fakeAgent({ installed: false }) });

  await nextCard();
  expect(agentCard().getByText("Claude Code is not available on this machine.")).toBeTruthy();
});

test("an agent's step names it, and that the session starts it", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  const next = await nextCard();
  expect(next.getByRole("heading", { name: "The agent writes the plan" })).toBeTruthy();
  expect(
    next.getByText("The agent takes it from here: open the session to start it."),
  ).toBeTruthy();
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
  expect(next.getByRole("heading", { name: "Merged" })).toBeTruthy();
  const files = screen.getByRole("list", { name: "Files" });
  expect(within(files).getByText("Record")).toBeTruthy();
  expect(within(files).queryByText("not yet")).toBeNull();
  expect(currentStage()).toBeUndefined();
});

/** C6 */
test("the files are compact rows with their status", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });

  const files = within(await screen.findByRole("list", { name: "Files" }));
  const rows = files.getAllByRole("listitem").map((item) => item.textContent);
  expect(rows).toEqual([
    "Proposalcommitted",
    "Questions, round 01answered",
    "Specawaiting-human",
    "Plannot yet",
  ]);
  expect(files.getByRole("link", { name: /Questions, round 01/ }).getAttribute("href")).toBe(
    atRepo(`/f/${RECURRING}/clarifications-01.md`),
  );
});

test("the header names the kind, the day, and the branch", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  expect(await screen.findByText(`Feature · Oct 12 · branch ${CLI}`)).toBeTruthy();
});

/** Review comment C1 of the old page: the mockups beside the files. */
test("the page links its mockups", async () => {
  const repo = fixtureRepo();
  addMockup(repo, RECURRING, "repeat.html");

  await renderPage(`/f/${RECURRING}`, repo);

  const link = await screen.findByRole("link", { name: /repeat\.html/ });
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

  await waitFor(() => expect(agentCard().getByText("Needs attention")).toBeTruthy());
  expect(agentCard().getByRole("img", { name: "Needs attention" })).toBeTruthy();
  expect(agentCard().getByText(/^Last run: Plan · done · /)).toBeTruthy();
  await click(agentCard().getByRole("link", { name: "Open the session" }));

  await opensEmpty(CLI);
  expect(await screen.findByText("The agent stopped before a human gate.")).toBeTruthy();
});

test("a working agent shows Working, Stop, and its run, and Stop stops it", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(agentCard().getByText("Working")).toBeTruthy());
  // A turn runs: "Next" no longer says the session starts it.
  expect(
    (await nextCard()).queryByText("The agent takes it from here: open the session to start it."),
  ).toBeNull();

  await click(agentCard().getByRole("button", { name: "Stop" }));

  await waitFor(() => expect(agent.interrupts).toBe(1));
  await refreshUntil(() => expect(agentCard().getByText(/^Last run: Plan · stopped/)).toBeTruthy());
  expect(agentCard().getByText("Needs attention")).toBeTruthy();
  await click(agentCard().getByRole("link", { name: "Open the session" }));

  await opensEmpty(CLI);
  expect(await screen.findByText("You stopped the agent.")).toBeTruthy();
  expect(agent.sent).toHaveLength(1);
});

test("a Stop that fails says why in the card", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(agentCard().getByText("Working")).toBeTruthy());
  vi.spyOn(fake.sessions, "stop").mockImplementation(() => {
    throw new Error("refused: The agent did not take the interrupt.");
  });

  await click(agentCard().getByRole("button", { name: "Stop" }));

  expect(await agentCard().findByText("The agent did not take the interrupt.")).toBeTruthy();
});

test("a failed run needs attention, and opens its session unfilled", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    { denials: [], errors: ["Rate limit reached"], interrupted: false, ok: false, type: "result" },
  ]);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(agentCard().getByText(/^Last run: Plan · failed/)).toBeTruthy());
  expect(agentCard().getByText("Needs attention")).toBeTruthy();

  await click(agentCard().getByRole("link", { name: "Open the session" }));

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

  const main = within(await screen.findByRole("list", { name: "Agents at work" }));
  await main.findByRole("link", { name: /Git listener process/ });
  const row = main
    .getAllByRole("listitem")
    .find((item) => within(item).queryByRole("link", { name: /Git listener process/ }))!;
  expect(within(row).getByText("Working")).toBeTruthy();
  expect(within(row).getByText("Discovery")).toBeTruthy();
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
    await agentCard().findByText(/^Last run: Finishing, draft pull request · done/),
  ).toBeTruthy();
  expect(agentCard().getByRole("link", { name: "Open the session" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
});
