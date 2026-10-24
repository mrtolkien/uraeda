// The spec in titled panes (US1): the block's pane titled by its first line, "You approve" first and
// the constitution under a separator at its foot (C1); the decisions right after the answers; the
// data model's sections as panes, on the spec and alone; an approved spec's same panes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import { atRepo, atWidth, fixture, fixtureRepo, git, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const BLOCK = "Spec to review, revision 2, about 10 minutes.";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** A pane of the page, a region named by its title, once drawn. */
const region = (name: string) => screen.findByRole("region", { name });

/** Whether `a` comes before `b` in the page. */
const before = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** US1 key 1 */
test("the block is a pane titled by its revision and time", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const block = await region(BLOCK);
  const main = screen.getByRole("main");
  expect(within(main).getAllByRole("region")[0]).toBe(block);
  // "You approve" first, before the block's other items.
  const lead = within(block).getByText(/^You approve tasks that repeat/);
  const other = within(block).getByText(/^Task storage changes: an upgrade/);
  expect(before(lead, other)).toBe(true);
  expect(block.textContent?.indexOf("You approve")).toBeLessThan(
    block.textContent?.indexOf("Every saved due date") ?? 0,
  );
});

/** C1: the constitution's principles and the risk's reason start under a separator. */
test("the principles and the risk's reason follow a separator at the block's foot", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const block = await region(BLOCK);
  const separator = within(block).getByRole("separator");
  const principle = within(block).getByText("III. Fast");
  const reason = within(block).getByText(/it converts every saved due date/);
  const lastItem = within(block).getByText(/This spec reads every title typed/);
  expect(before(lastItem, separator)).toBe(true);
  expect(before(separator, principle)).toBe(true);
  expect(before(separator, reason)).toBe(true);
});

/** C1: a block with no time, no risk tier, no principles, and no risk's reason has no foot. */
test("a block with nothing for its foot draws no separator", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = `specs/${SPEC_FEATURE}/spec.md`;
  const text = readFileSync(fixture(`spec-page/branch/${spec}`), "utf8")
    .replace("risk-tier: high\n", "")
    .replace(", about 10 minutes.", ".")
    .replace(/## Constitution check\n[\s\S]*?(?=## History)/, "");
  commitOnBranch(repo, SPEC_FEATURE, { [spec]: text });
  await renderPage(PAGE, repo);

  const block = await region("Spec to review, revision 2.");
  expect(within(block).getByText(/^You approve tasks that repeat/)).toBeTruthy();
  expect(within(block).queryByRole("separator")).toBeNull();
});

/** US1 key 2 */
test("Decisions · 1 new, 1 changed, 1 removed follows the answers", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const answers = await region("Your review, answered");
  const heading = screen.getByRole("heading", {
    level: 2,
    name: "Decisions · 1 new, 1 changed, 1 removed",
  });
  // Right after: the first heading of level 2 past the answers' pane is the decisions'.
  const after = screen
    .getAllByRole("heading", { level: 2 })
    .filter((h) => !answers.contains(h) && before(answers, h));
  expect(after[0]).toBe(heading);
  expect(before(heading, await region("Repeating tasks"))).toBe(true);
});

/** US1 more 1 */
test("Data holds a pane per section after the stories, its changes as badges", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const data = await screen.findByRole("heading", { level: 2, name: "Data · data-model.md · 2" });
  const stories = screen.getByRole("heading", { level: 2, name: "User stories · 4" });
  expect(before(stories, data)).toBe(true);
  const task = await region("Task");
  const rule = await region("Repeat rule");
  expect(before(data, task)).toBe(true);
  expect(before(task, rule)).toBe(true);
  expect(within(task).getByText("Changed")).toBeTruthy();
  expect(within(task).getByText("New")).toBeTruthy();
  expect(within(rule).getAllByText("New")).toHaveLength(4);
});

/** US1 more 2 */
test("the data model alone draws the same panes", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(`/f/${SPEC_FEATURE}/data-model.md`, repo);

  const task = await region("Task");
  const rule = await region("Repeat rule");
  expect(before(task, rule)).toBe(true);
  expect(within(task).getByText("Changed")).toBeTruthy();
  expect(within(rule).getAllByText("New")).toHaveLength(4);
  expect(screen.getByText("Entities that the feature adds or changes.")).toBeTruthy();
});

/** A row's change is a badge in its "Change" column alone, not in a cell that reads the same. */
test("a row marked New badges its Change cell only", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  commitOnBranch(repo, SPEC_FEATURE, {
    [`specs/${SPEC_FEATURE}/data-model.md`]:
      "# Data model: X\n\n## Label\n\n| Field | Meaning | Change |\n| ----- | ------- | ------ |\n| `tag` | New     | New    |\n",
  });
  await renderPage(`/f/${SPEC_FEATURE}/data-model.md`, repo);

  const label = await region("Label");
  expect(within(label).getAllByText("New")).toHaveLength(2);
  expect(label.querySelectorAll(".astryx-badge")).toHaveLength(1);
});

/** A data model alone draws the HTML mockups its paragraphs embed live, as a document does. */
test("the data model alone draws an HTML mockup live", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  commitOnBranch(repo, SPEC_FEATURE, {
    [`specs/${SPEC_FEATURE}/data-model.md`]:
      "# Data model: X\n\n## Label\n\n[Title with a repeat phrase](mockups/title.html)\n",
  });
  await renderPage(`/f/${SPEC_FEATURE}/data-model.md`, repo);

  const label = await region("Label");
  expect(
    await within(label).findByRole("region", { name: "live · Title with a repeat phrase" }),
  ).toBeTruthy();
});

/** A link to an entity of the data model alone, `data-model.md#repeat-rule`, lands on its pane. */
test("the data model alone scrolls to the section its hash names", async () => {
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(`/f/${SPEC_FEATURE}/data-model.md#repeat-rule`, repo);

  const rule = await region("Repeat rule");
  expect(document.getElementById("repeat-rule")).toBe(rule);
  await waitFor(() => expect(scrolled.mock.contexts.at(-1)).toBe(rule));
});

/**
 * R13: the record line is the block pane's title, which takes no comment: a pending comment saved on
 * it draws at the top of the pane's body, where it is edited and removed.
 */
test("a pending comment on the block's record line draws at the top of its pane", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const worktree = join(repo, ".worktrees", SPEC_FEATURE);
  git(repo, "worktree", "add", "--quiet", worktree, SPEC_FEATURE);
  const tip = git(repo, "rev-parse", "--short=7", SPEC_FEATURE).trim();
  writeFileSync(
    join(worktree, "specs", SPEC_FEATURE, "spec-review.md"),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line 13, under "Spec: Recurring tasks"\n\n> ${BLOCK}\n\nShorter?\n`,
  );
  await renderPage(PAGE, repo);

  const pending = await screen.findByRole("group", { name: "C1 · line 13" });
  const block = await region(BLOCK);
  expect(block.contains(pending)).toBe(true);
  expect(before(pending, within(block).getByText(/^You approve tasks that repeat/))).toBe(true);
  expect(within(pending).getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(within(pending).getByRole("button", { name: "Remove" })).toBeTruthy();
});

/** US1: a story is a pane titled by its id and title, its priority beside the title. */
test("a story is a pane titled US2 · its title, with its priority", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await region("US2 · Complete a repeating task");
  const heading = within(story).getAllByRole("heading", { level: 3 })[0]!;
  expect(heading.textContent).toContain("P1");
});

/** US1 more 3 */
test("an approved spec draws its panes, no Review tab, no verdict", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { status: "approved" });
  await renderPage(PAGE, repo);

  const block = await region("Approved on 2026-10-18.");
  expect(within(block).getByText(/^You approve tasks that repeat/)).toBeTruthy();
  expect(await region("Your review, answered")).toBeTruthy();
  expect(await region("Task storage")).toBeTruthy();
  expect(await region("US2 · Complete a repeating task")).toBeTruthy();
  expect(await region("Task")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByRole("tab", { name: "Review" })).toBeNull();
});

/** History's fold, as the spec's other folds, is kept in the history entry: Back opens it again. */
test("History opened is open again on Back", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { revision: 3 });
  await renderPage(PAGE, repo);
  const opened = await screen.findByRole("button", { name: "History" });
  await act(async () => {
    fireEvent.click(opened);
  });
  expect(screen.getByText(/Changes requested on 2026-10-07/)).toBeTruthy();

  await act(async () => navigate(atRepo(`/f/${SPEC_FEATURE}/proposal.md`)));
  await waitFor(() => expect(screen.queryByRole("button", { name: "History" })).toBeNull());
  await act(async () => window.history.back());

  const history = await screen.findByRole("button", { name: "History" });
  expect(history.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText(/Changes requested on 2026-10-07/)).toBeTruthy();
});

/** A link into History opens its fold. */
test("a hash into History opens it", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { revision: 3 });
  await renderPage(`${PAGE}#history`, repo);

  const history = await screen.findByRole("button", { name: "History" });
  await waitFor(() => expect(history.getAttribute("aria-expanded")).toBe("true"));
  expect(await screen.findByText(/Changes requested on 2026-10-07/)).toBeTruthy();
});

/** A jump from Contents puts the focus in the pane it brings to the top. */
test("a jump from Contents focuses the decision's and the story's pane", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const column = await screen.findByRole("tabpanel", { name: "Contents" });
  for (const [entry, pane] of [
    ["Task storage", "Task storage"],
    ["US2 Complete a repeating task", "US2 · Complete a repeating task"],
  ] as const) {
    await act(async () => {
      fireEvent.click(within(column).getByRole("link", { name: entry }));
    });
    const target = await region(pane);
    await waitFor(() => expect(target.contains(document.activeElement), pane).toBe(true));
  }
});
