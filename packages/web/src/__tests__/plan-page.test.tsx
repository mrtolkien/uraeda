import { readFileSync } from "node:fs";
import { screen, waitFor, within } from "@testing-library/react";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import { atWidth, fixture, fixtureRepo, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-13-plan-review";
const PAGE = `/f/${FOLDER}/plan.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** The questions page's plan, `fixtures/plan-page/plan.md`, with its status, made by `edit`. */
function questionsPlan(status: string, edit = (text: string) => text) {
  const text = readFileSync(fixture("plan-page/plan.md"), "utf8");
  return edit(text.replace(/^status: .*$/m, `status: ${status}`));
}

/** A repository whose plan-review feature holds `plan` as its plan. */
function repoWith(plan: string) {
  const repo = fixtureRepo();
  commitOnBranch(repo, FOLDER, { [`specs/${FOLDER}/plan.md`]: plan });
  return repo;
}

/** A part of the page, a region named by its title, once drawn. */
const region = (name: string) => screen.findByRole("region", { name });

/** Whether each element comes after the one before it in the page. */
function inOrder(elements: ReadonlyArray<HTMLElement>) {
  return elements.every(
    (element, index) =>
      index === 0 ||
      !!(elements[index - 1]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
}

/** The sections a plan draws as panes, in the questions page's plan's order. */
const SECTIONS = ["Goal", "Architecture", "Review focus", "Global constraints", "Waves"];

const FIRST_TASK = "Task 1 · The session's view, scrolling in the round's column";

/** US6 1 */
test("the plan draws its sections and tasks in panes", async () => {
  await renderPage(PAGE, repoWith(questionsPlan("auto-approved")));

  const regions = [];
  for (const name of [...SECTIONS, FIRST_TASK]) {
    regions.push(await region(name));
  }
  expect(inOrder(regions)).toBe(true);
  const [goal] = regions;
  expect(goal!.textContent).toContain("the round of questions draws in titled panes");
  expect(goal!.textContent).not.toContain("Goal:");
  expect(within(regions.at(-1)!).getByText("6/6")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
});

/** US6 2 */
test("a plan waiting for review draws the same panes, and the verdict", async () => {
  await renderPage(PAGE, repoWith(questionsPlan("awaiting-human")));

  for (const name of [...SECTIONS, FIRST_TASK]) {
    expect(await region(name)).toBeTruthy();
  }
  expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
});

/** Edge case: a plan with no tasks yet. */
test("a plan with no tasks draws its sections", async () => {
  const plan = questionsPlan("auto-approved", (text) => text.replace(/\n## Task 1:[\s\S]*$/, "\n"));
  await renderPage(PAGE, repoWith(plan));

  for (const name of SECTIONS) {
    expect(await region(name)).toBeTruthy();
  }
  expect(screen.queryByRole("region", { name: /^Task \d/ })).toBeNull();
});

/** US6 2, moved from the review's tests (R4) */
test("a plan shows each task's steps checked out of its total", async () => {
  await renderPage(PAGE);

  const task = await region("Task 5 · Repeats typed in the title");
  expect(within(task).getByText("2/5")).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "high" })).toBeNull();
});

/** A link to a task's heading, `plan.md#task-1-…`, lands on its pane; the title keeps its anchor. */
test("a task's anchor names its pane and the page scrolls to it", async () => {
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  const anchor = "task-1-the-sessions-view-scrolling-in-the-rounds-column";
  await renderPage(`${PAGE}#${anchor}`, repoWith(questionsPlan("auto-approved")));

  const task = await region(FIRST_TASK);
  expect(document.getElementById(anchor)).toBe(task);
  await waitFor(() => expect(scrolled.mock.contexts.at(-1)).toBe(task));
  expect(document.getElementById("plan-questions-page-in-the-terminal-look")?.tagName).toBe("H1");
});

/** A lead pane's id cannot be a section's anchor: "lead-" then its label, as an anchor. */
test("a lead pane's id is its label's slug after lead-", async () => {
  const plan = questionsPlan("auto-approved", (text) =>
    text.replace("**Architecture:**", "**Tech stack:**").replace(/^## Waves$/m, "## Tech stack"),
  );
  await renderPage(PAGE, repoWith(plan));

  const lead = (await screen.findAllByRole("region", { name: "Tech stack" }))[0]!;
  expect(document.getElementById("lead-tech-stack")).toBe(lead);
  expect(document.getElementById("tech-stack")).not.toBe(lead);
});
