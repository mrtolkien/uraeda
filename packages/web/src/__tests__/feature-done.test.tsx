// What a feature produced, its figures, and a done one's record drawn in place. Times are read in
// UTC (`vite.config.ts`).
import { act, screen, waitFor, within } from "@testing-library/react";
import { commitsAt, type DatedCommit } from "uraeda-binding/test-utils";
import { expect, test, vi } from "vite-plus/test";
import { click, type Fake, fakeAgent, fixtureRepo, git, renderPage } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const DONE = "2026-10-17-clarity";
const CHANGE = "2026-10-17-symlinks";

/** `count` numbered lines of text. */
function lines(count: number, prefix = "line"): string {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index}\n`).join("");
}

/** A record of a feature, with ten questions in one round, and its pull request when given. */
function featureRecord(pullRequest?: string) {
  const questions = Array.from(
    { length: 10 },
    (_, index) => `#### Q${index + 1}: Question ${index + 1}?\n\n**Answer:** A.\n`,
  ).join("\n");
  const front = pullRequest ? `pull-request: ${pullRequest}\n` : "";
  return `---\nkind: feature\nfinished: 2026-10-17\n${front}---\n\n# Record: Clarity\n\n## What and why\n\nRounds read as a flat list.\n\n## Behaviour\n\n- A round opens with a verdict.\n\n## Design\n\nCards.\n\n## Questions\n\n### Round 01\n\n${questions}\n## Decisions\n\n- New: Diagrams.\n\n## Follow-ups\n\n- Keyboard navigation, left for later.\n`;
}

/** A change's record, without questions. */
const CHANGE_RECORD = `---\nkind: change\nfinished: 2026-10-17\n---\n\n# Record: Symlinks\n\n## What and why\n\nNew worktrees took minutes.\n\n## Behaviour\n\n- A worktree links the ignored folders.\n\n## Design\n\nLinks.\n`;

const DIAGRAMS =
  "# Diagrams\n\nFlows are Mermaid code blocks.\n\n## Rules\n\n- Draw flows as Mermaid.\n";

/**
 * The clarity feature, merged by rebase onto `main`: its typed commits from 10:52 to its finish at
 * 22:03, committed at 22:09, adding the Diagrams decision.
 */
function doneFeature(repo: string, record = featureRecord()) {
  const folder = `specs/${DONE}`;
  const commits: Array<DatedCommit> = [
    {
      at: "2026-10-17T10:52:00Z",
      files: { [`${folder}/proposal.md`]: "# Proposal: Clarity\n" },
      message: "proposal(clarity): x",
    },
    {
      at: "2026-10-17T12:11:00Z",
      files: { [`${folder}/spec.md`]: "# Spec\n" },
      message: "spec(clarity): x",
    },
    {
      at: "2026-10-17T15:01:00Z",
      files: { "specs/decisions/diagrams.md": DIAGRAMS },
      message: "decision(clarity): diagrams",
    },
    {
      at: "2026-10-17T15:08:00Z",
      files: { [`${folder}/plan.md`]: "# Plan\n" },
      message: "plan(clarity): x",
    },
    {
      at: "2026-10-17T15:20:00Z",
      files: { "src/round.ts": lines(40) },
      message: "feat(clarity): x",
    },
    {
      at: "2026-10-17T22:03:00Z",
      committed: "2026-10-17T22:09:00Z",
      files: {
        [`${folder}/plan.md`]: null,
        [`${folder}/proposal.md`]: null,
        [`${folder}/spec.md`]: null,
        [`specs/done/${DONE}.md`]: record,
      },
      message: "finish(clarity): x",
    },
  ];
  commitsAt(repo, "main", commits);
}

/** What the feature produced: its figures, then its files. */
function produced() {
  return within(screen.getByRole("region", { name: /^What it produced/ }));
}

/** A figure's card, a group named by its label, whether it leads to its detail or not. */
function figureCard(label: string): HTMLElement {
  return produced().getByRole("group", { name: label });
}

/** A figure's text. */
function figure(label: string): string {
  return figureCard(label).textContent ?? "";
}

/** A figure's value, one entry per line: tokens in, then out. */
function figureLines(label: string): Array<string> {
  return within(figureCard(label))
    .getAllByText(/^[\d.,]+( [kM])? (in|out)$/)
    .map((element) => element.textContent ?? "");
}

/** A region of the page, by its name. */
function region(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

/** The stage of this label's line, its no-break spaces read as spaces. */
function stageLine(label: string): string {
  const item = within(screen.getByRole("list", { name: "Stages" }))
    .getAllByRole("listitem")
    .find((li) => within(li).queryByText(label, { exact: true }));
  if (!item) {
    throw new Error(`No stage ${label}`);
  }
  return within(item)
    .getAllByText(/./)
    .map((element) => element.textContent ?? "")
    .filter((text) => text !== label && text !== "completed")
    .join(" ")
    .replaceAll(" ", " ");
}

/** Adds an ended turn to a feature's session, with its own counts, started at `at`. */
async function turnWithTokens(
  fake: Fake,
  repo: string,
  folder: string,
  at: string,
  tokens: { cacheRead: number; cacheWrite: number; input: number; output: number } | null,
) {
  const { cache } = fake.sessions;
  const session = await fake.sessions.featureSession(repo, folder);
  const id = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "implementation",
    trigger: "manual",
  });
  if (tokens) {
    cache.addTurnTokens(id, tokens);
  }
  cache.endTurn(id, { state: "done" });
  cache.db.prepare("UPDATE turns SET started_at = ? WHERE id = ?").run(at, id);
}

/** US1 more 4 */
test("lines changed read in green and red, with the files", async () => {
  const repo = fixtureRepo();
  // A file on the default branch, merged into the branch, then removed by it: its merge brings
  // nothing, and its removal counts.
  commitsAt(repo, "main", [{ files: { "src/old.ts": lines(310, "old") }, message: "chore: old" }]);
  git(repo, "switch", "--quiet", CLI);
  git(repo, "merge", "--quiet", "--no-edit", "main");
  git(repo, "switch", "--quiet", "main");
  // 21 files of 54 lines and one of 70: 1,204 lines added, over 23 files with the removed one.
  const added = Object.fromEntries(
    Array.from({ length: 22 }, (_, index) => [`src/f${index}.ts`, lines(index === 0 ? 70 : 54)]),
  );
  commitsAt(repo, CLI, [
    { files: { ...added, "src/old.ts": null }, message: "feat(cli-tuis): x" },
    { files: { [`specs/${CLI}/notes.md`]: lines(500) }, message: "docs(cli-tuis): x" },
  ]);

  await renderPage(`/f/${CLI}`, repo, { agent: true });

  const link = await screen.findByRole("link", { name: /^Lines changed/ });
  expect(link.getAttribute("href")).toBe("#files");
  const lineCard = within(figureCard("Lines changed"));
  expect(lineCard.getByText("+1,204")).toBeTruthy();
  expect(lineCard.getByText("−310")).toBeTruthy();
  expect(lineCard.getByText("23 files")).toBeTruthy();
  expect(region("What it produced so far")).toBeTruthy();
});

/** US2.1 */
test("a done feature's total time and timed stages", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  await screen.findByRole("link", { name: /^Total time/ });
  expect(figure("Total time")).toContain("11 h 11 min");
  expect(figure("Total time")).toContain("10:52 to 22:03");
  expect(stageLine("Merged")).toBe("22:09");
  expect(screen.getByRole("link", { name: /^Total time/ }).getAttribute("href")).toBe("#stages");
});

/** US2.2 */
test("tokens leave cache reads out, on two lines", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);
  const fake = await fakeAgent();
  await turnWithTokens(fake, repo, DONE, "2026-10-17T10:52:00.000Z", {
    cacheRead: 146_726_052,
    cacheWrite: 5_174_704,
    input: 2712,
    output: 113_407,
  });

  await renderPage(`/f/${DONE}`, repo, { agent: fake });

  await screen.findByRole("group", { name: "Tokens" });
  expect(figureLines("Tokens")).toEqual(["5.2 M in", "113 k out"]);
  expect(figure("Tokens")).toContain("cache reads left out");
});

/** US2.3 */
test("Decisions leads to the decisions, drawn as changes", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  // The record, drawn once its file is read.
  await screen.findByRole("region", { name: "Decisions" });
  const decisions = produced().getByRole("link", { name: /^Decisions/ });
  expect(within(figureCard("Decisions")).getByText("1")).toBeTruthy();
  const scrolled = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
  const { length } = window.history;
  await click(decisions);
  // An in-page jump: the page scrolls to the decisions, in the same history entry.
  expect(scrolled.mock.contexts).toContain(document.getElementById("decisions"));
  expect(window.history.length).toBe(length);
  scrolled.mockRestore();
  const drawn = within(region("Decisions"));
  expect(drawn.getByText("New")).toBeTruthy();
  expect(drawn.getByText("Diagrams")).toBeTruthy();
  expect(drawn.getByText("Draw flows as Mermaid.")).toBeTruthy();
  // The record's own list of decisions is not drawn: the changes are.
  expect(screen.queryByText("New: Diagrams.")).toBeNull();
});

/** US2 more 1 */
test("the record shows in place, its questions folded", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  expect(await screen.findByRole("heading", { name: "What and why" })).toBeTruthy();
  expect(screen.getByText("Rounds read as a flat list.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Behaviour" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Follow-ups" })).toBeTruthy();
  expect(screen.getByText("Keyboard navigation, left for later.")).toBeTruthy();
  const questions = screen.getByRole("button", { name: "Questions · 10 in 1 round" });
  expect(questions.getAttribute("aria-expanded")).toBe("false");
  // A button holds no heading: its region is named instead.
  expect(within(questions).queryByRole("heading")).toBeNull();
  expect(within(region("Questions")).getByRole("button")).toBe(questions);
  expect(screen.getByRole("link", { name: "Questions: 10, 1 round" }).getAttribute("href")).toBe(
    "#questions",
  );
  expect(screen.getByRole("heading", { level: 2, name: "What it produced" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the record file" })).toBeTruthy();
});

/** US2: a row of five figures, a feature's questions and decisions shown at zero */
test("a done feature without a round or a decision shows its five figures", async () => {
  const repo = fixtureRepo();
  const folder = `specs/${DONE}`;
  const record = `---\nkind: feature\nfinished: 2026-10-17\n---\n\n# Record: Clarity\n\n## What and why\n\nRounds read as a flat list.\n\n## Behaviour\n\n- A round opens with a verdict.\n\n## Design\n\nCards.\n`;
  commitsAt(repo, "main", [
    {
      at: "2026-10-17T10:52:00Z",
      files: { [`${folder}/proposal.md`]: "# Proposal: Clarity\n" },
      message: "proposal(clarity): x",
    },
    {
      at: "2026-10-17T12:11:00Z",
      files: { [`${folder}/spec.md`]: "# Spec\n" },
      message: "spec(clarity): x",
    },
    {
      at: "2026-10-17T15:08:00Z",
      files: { [`${folder}/plan.md`]: "# Plan\n" },
      message: "plan(clarity): x",
    },
    {
      at: "2026-10-17T15:20:00Z",
      files: { "src/round.ts": lines(40) },
      message: "feat(clarity): x",
    },
    {
      at: "2026-10-17T22:03:00Z",
      files: {
        [`${folder}/plan.md`]: null,
        [`${folder}/proposal.md`]: null,
        [`${folder}/spec.md`]: null,
        [`specs/done/${DONE}.md`]: record,
      },
      message: "finish(clarity): x",
    },
  ]);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  await screen.findByRole("group", { name: "Tokens" });
  const labels = produced()
    .getAllByRole("group")
    .map((group) => group.getAttribute("aria-label"));
  expect(labels).toEqual(["Total time", "Lines changed", "Tokens", "Questions", "Decisions"]);
  expect(figure("Questions")).toBe("Questions0no round");
  expect(figure("Decisions")).toContain("0");
  // Nothing to open at zero: plain cards.
  expect(produced().queryByRole("link", { name: /^Questions/ })).toBeNull();
  expect(produced().queryByRole("link", { name: /^Decisions/ })).toBeNull();
});

/** Decision ui-behaviour: Back restores the open items */
test("the questions opened stay open across Back", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  await click(await screen.findByRole("button", { name: "Questions · 10 in 1 round" }));
  await click(screen.getByRole("link", { name: "Open the record file" }));
  await waitFor(() => expect(location.pathname).toContain(`/f/${DONE}/${DONE}.md`));
  await act(async () => window.history.back());

  const questions = await screen.findByRole("button", { name: "Questions · 10 in 1 round" });
  expect(questions.getAttribute("aria-expanded")).toBe("true");
});

/** Decision ui-behaviour: Back restores the open items, after a figure's jump */
test("a fold opened after a figure's jump stays open across Back", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });
  // Reloaded as the app opens its pages: its history entry has an id, which keeps its open items.
  window.history.replaceState({ id: "opened" }, "");
  await renderPage(`/f/${DONE}`, repo, { agent: true, reload: true });

  await screen.findByRole("region", { name: "Decisions" });
  await click(produced().getByRole("link", { name: /^Decisions/ }));
  expect((window.history.state as { id?: string } | null)?.id).toBe("opened");
  await click(screen.getByRole("button", { name: "Questions · 10 in 1 round" }));
  await click(screen.getByRole("link", { name: "Open the record file" }));
  await waitFor(() => expect(location.pathname).toContain(`/f/${DONE}/${DONE}.md`));
  await act(async () => window.history.back());

  const questions = await screen.findByRole("button", { name: "Questions · 10 in 1 round" });
  expect(questions.getAttribute("aria-expanded")).toBe("true");
});

/** C9: each figure opens its detail */
test("Questions opens the questions", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  const fold = await screen.findByRole("button", { name: "Questions · 10 in 1 round" });
  await click(produced().getByRole("link", { name: /^Questions/ }));
  expect(fold.getAttribute("aria-expanded")).toBe("true");
});

/** US2 more 2 */
test("a feature without token counts reads Not recorded", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);
  const fake = await fakeAgent();
  // A turn ended before tokens were recorded.
  await turnWithTokens(fake, repo, DONE, "2026-10-17T10:52:00.000Z", null);

  await renderPage(`/f/${DONE}`, repo, { agent: fake });

  const tokens = await screen.findByRole("group", { name: "Tokens" });
  expect(within(tokens).getByText("Not recorded")).toBeTruthy();
  expect(within(tokens).queryByText(/ in$/)).toBeNull();
});

/** US3.2 */
test("a merged change without a question shows its four stages and its record", async () => {
  const repo = fixtureRepo();
  const folder = `specs/changes/${CHANGE}`;
  commitsAt(repo, "main", [
    {
      at: "2026-10-17T15:40:00Z",
      files: { [`${folder}/proposal.md`]: "# Symlinks\n" },
      message: "proposal(symlinks): x",
    },
    { at: "2026-10-17T15:44:00Z", files: { "src/link.ts": lines(9) }, message: "fix(symlinks): x" },
    {
      at: "2026-10-17T16:06:00Z",
      committed: "2026-10-17T16:13:00Z",
      files: { [`${folder}/proposal.md`]: null, [`specs/done/${CHANGE}.md`]: CHANGE_RECORD },
      message: "finish(symlinks): x",
    },
  ]);

  await renderPage(`/f/${CHANGE}`, repo, { agent: true });

  expect(await screen.findByRole("heading", { name: "What and why" })).toBeTruthy();
  const stages = within(screen.getByRole("list", { name: "Stages" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
  expect(stages.map((text) => text.match(/Proposal|Fix|Pull request|Merged/)?.[0])).toEqual([
    "Proposal",
    "Fix",
    "Pull request",
    "Merged",
  ]);
  expect(stageLine("Fix")).toBe("15:44 · 22 min");
  expect(figure("Total time")).toContain("26 min");
  expect(screen.queryByRole("link", { name: /^Questions/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Questions ·/ })).toBeNull();
});

/** Edge case: squash merge */
test("a squash-merged feature says its figures were not found", async () => {
  const repo = fixtureRepo();
  commitsAt(repo, "main", [
    {
      files: { [`specs/done/${DONE}.md`]: featureRecord(), "src/round.ts": lines(40) },
      message: "Clarity (#30)",
    },
  ]);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  expect(await screen.findByText("Not found on the default branch")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /^Lines changed/ })).toBeNull();
  expect(screen.queryByRole("group", { name: "Lines changed" })).toBeNull();
  expect(screen.queryByText("0 files")).toBeNull();
});

/** Edge case: partial tokens */
test("tokens counted from a later turn say since when", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);
  const fake = await fakeAgent();
  await turnWithTokens(fake, repo, DONE, "2026-10-17T10:52:00.000Z", null);
  const counts = { cacheRead: 9000, cacheWrite: 1500, input: 200, output: 800 };
  await turnWithTokens(fake, repo, DONE, "2026-10-19T09:00:00.000Z", counts);

  await renderPage(`/f/${DONE}`, repo, { agent: fake });

  await screen.findByRole("group", { name: "Tokens" });
  expect(figureLines("Tokens")).toEqual(["1.7 k in", "800 out"]);
  expect(figure("Tokens")).toContain("since Oct 19");
});

/** Review focus 9 */
test("a record without its pull request draws Lines changed as a plain card", async () => {
  const repo = fixtureRepo();
  doneFeature(repo);

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  const lineCard = await screen.findByRole("group", { name: "Lines changed" });
  expect(within(lineCard).getByText("+47")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /^Lines changed/ })).toBeNull();
});

/** Review focus 9, with the pull request */
test("a record with its pull request leads Lines changed to its files", async () => {
  const repo = fixtureRepo();
  doneFeature(repo, featureRecord("https://github.com/o/r/pull/30"));

  await renderPage(`/f/${DONE}`, repo, { agent: true });

  const lineCard = await screen.findByRole("link", { name: /^Lines changed/ });
  expect(lineCard.getAttribute("href")).toBe("https://github.com/o/r/pull/30/files");
});
