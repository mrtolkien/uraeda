// The parts after the stories, each drawn for what it holds (US8): the edge cases by importance,
// the niche ones folded; the criteria's ids and measures as pills; the architecture's units as
// cards and its tradeoffs as costs; the data model's tables, by entity.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, git, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const SPEC = `specs/${SPEC_FEATURE}/spec.md`;
const REVIEW = `specs/${SPEC_FEATURE}/spec-review.md`;
const DATA = `specs/${SPEC_FEATURE}/data-model.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** A part of the page, a region named by its title, once drawn. */
const region = (name: string) => screen.findByRole("region", { name });

/**
 * Whether an element is folded away: inside the region a closed trigger controls, which a screen
 * reader skips and the browser does not draw.
 */
function folded(element: Element) {
  return [...document.querySelectorAll("[aria-expanded='false'][aria-controls]")].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(element),
  );
}

/** The rows of a list, the first in `part` unless told otherwise. */
function rowsOf(part: HTMLElement, list = 0) {
  return within(within(part).getAllByRole("list")[list]!).getAllByRole("listitem");
}

/** An edge case's importance, as its pill reads. */
const importance = (row: HTMLElement) => within(row).getByText(/^(High|Normal|Niche)$/).textContent;

/** The line of the spec holding a phrase, on the feature's branch. */
function lineOf(repo: string, phrase: string) {
  const lines = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`).split("\n");
  return lines.findIndex((line) => line.includes(phrase)) + 1;
}

/** The entries of "Contents", by the text of their links. */
async function entries() {
  const column = await screen.findByRole("complementary", { name: "Contents" });
  return within(column)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

/** US8 1 */
test("edge cases show high, then normal, then the niche ones folded", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  // The file lists them out of order: a niche case, then the normal one, before the high ones.
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  const lines = spec.split("\n");
  const first = [lines.find((line) => line.startsWith("| Niche"))!];
  first.push(lines.find((line) => line.startsWith("| Normal"))!);
  const moved = first.reduce((text, line) => text.replace(`${line}\n`, ""), spec);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: moved.replace("| High ", `${first.join("\n")}\n| High `),
  });
  await renderPage(PAGE, repo);

  const part = await region("Edge cases");
  expect(rowsOf(part).map(importance)).toEqual(["High", "High", "Normal"]);
  expect(rowsOf(part)[0]!.textContent).toContain("The due date moved by hand");
  expect(rowsOf(part)[0]!.textContent).toContain("the schedule restarts from the new date");
  const fold = within(part).getByRole("button", { name: "2 niche cases" });
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  const nicheRow = within(part).getByText(/A title made only of "every monday"/);
  expect(folded(nicheRow)).toBe(true);

  await click(fold);

  expect(fold.getAttribute("aria-expanded")).toBe("true");
  expect(folded(nicheRow)).toBe(false);
  expect(rowsOf(part, 1).map(importance)).toEqual(["Niche", "Niche"]);
});

/** Comments keep working: a pending comment on a niche case opens its fold, to show it. */
test("a pending comment on a niche case shows it, its fold open", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const tip = git(repo, "rev-parse", "--short=7", SPEC_FEATURE).trim();
  const line = lineOf(repo, "EVERY MONDAY");
  commitOnBranch(repo, SPEC_FEATURE, {
    [REVIEW]: `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line ${line}, under "Edge cases"\n\n> | Niche | A repeat phrase in capitals |\n\nAnd mixed case?\n`,
  });
  await renderPage(PAGE, repo);

  const part = await region("Edge cases");
  const fold = await within(part).findByRole("button", { name: "2 niche cases" });
  await waitFor(() => expect(fold.getAttribute("aria-expanded")).toBe("true"));
  const comment = within(part).getByRole("group", { name: `C1 · line ${line}` });
  expect(comment.textContent).toContain("And mixed case?");
  expect(folded(comment)).toBe(false);
});

/** A comment on a niche case keeps its fold open, whatever the fold was left at before it. */
test("a niche case under a comment keeps its fold open, though it was closed by hand", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const part = await region("Edge cases");
  const fold = within(part).getByRole("button", { name: "2 niche cases" });
  await click(fold);
  await click(fold);
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  await click(fold);
  const niche = rowsOf(part, 1)[0]!;
  await click(within(niche).getByRole("button"));
  await waitFor(() => expect(screen.getByLabelText("Comment text")).toBeTruthy());

  await click(fold);

  expect(fold.getAttribute("aria-expanded")).toBe("true");
  expect(folded(niche)).toBe(false);
});

/** US8 2 */
test("a criterion shows its id and measure as pills, then its sentence", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const part = await region("Success criteria");
  const [first, second] = rowsOf(part);
  expect(within(first!).getByText("SC-001")).toBeTruthy();
  expect(within(first!).getByText("two clicks")).toBeTruthy();
  expect(
    within(first!).getByText("Setting a preset repeat takes two clicks from the open task."),
  ).toBeTruthy();
  expect(first!.textContent).not.toContain("(two clicks)");
  expect(within(second!).getByText("SC-002")).toBeTruthy();
  expect(within(second!).getByText("no slower")).toBeTruthy();
});

/** US8 2: a criterion's sentence starts after its id, its measure, and their colon, marks kept. */
test("a criterion's sentence holds what follows its id and measure, with its marks", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec.replace(
      "- **SC-002** (no slower):",
      "- **SC-003**: A list of **5,000 tasks** needs `no` upgrade.\n- **SC-004** (a sentence: with a colon): Ends *here*.\n- **SC-002** (no slower):",
    ),
  });
  await renderPage(PAGE, repo);

  const part = await region("Success criteria");
  const rows = rowsOf(part);
  expect(rows).toHaveLength(4);
  // No measure: no pill, and the colon after the id is not drawn.
  const row = (id: string) => rows.find((r) => within(r).queryByText(id))!;
  const none = row("SC-003");
  expect(none.textContent).toBe("SC-003A list of 5,000 tasks needs no upgrade.");
  expect(within(none).getByText("5,000 tasks").tagName).toBe("STRONG");
  expect(within(none).getByText("no").tagName).toBe("CODE");
  const colon = row("SC-004");
  expect(within(colon).getByText("a sentence: with a colon")).toBeTruthy();
  expect(colon.textContent).toBe("SC-004a sentence: with a colonEnds here.");
  expect(within(colon).getByText("here").tagName).toBe("EM");
});

/** US8 3 */
test("the architecture's units are bullets, its tradeoffs with a Cost pill", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const part = await region("Architecture");
  expect(part.textContent).toContain("A repeating task stays a normal task with a repeat rule.");
  for (const name of ["Date helpers", "Repeat rules", "The task store"]) {
    expect(within(part).getByText(name)).toBeTruthy();
  }
  expect(part.textContent).toContain("compute calendar days, and own every date calculation.");
  expect(part.textContent).not.toContain("Tradeoffs:");
  const costs = within(within(part).getByRole("list", { name: "Tradeoffs" })).getAllByRole(
    "listitem",
  );
  expect(costs).toHaveLength(2);
  for (const cost of costs) {
    expect(within(cost).getByText("Cost")).toBeTruthy();
  }
  expect(costs[1]!.textContent).toContain("Every saved due date is converted once");
});

/** Comments keep working: a unit and a criterion take a comment on their line. */
test("a unit's card takes a comment on its line", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const part = await region("Architecture");
  const unit = within(part).getByRole("button", { name: /^Date helpers/ });
  await click(unit);
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {
    fireEvent.change(field, { target: { value: "Which time zone?" } });
  });
  await click(screen.getByRole("button", { name: "Add comment" }));

  const line = lineOf(repo, "**Date helpers**");
  await waitFor(() =>
    expect(within(part).getByRole("group", { name: `C1 · line ${line}` }).textContent).toContain(
      "Which time zone?",
    ),
  );
  const review = readFileSync(join(repo, ".worktrees", SPEC_FEATURE, REVIEW), "utf8");
  expect(review).toContain(`## C1: Line ${line}, under "Architecture"`);
});

/** US8 more 2: the colours themselves are checked in WebKit (`__browser__/spec-parts.test.tsx`). */
test("the data model's changes are coloured pills", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const data = git(repo, "show", `${SPEC_FEATURE}:${DATA}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [DATA]: data.replace(
      /(\| `repeat` .*\n)/,
      "$1| `done`    | yes or no                  | whether it is done                         | Removed |\n",
    ),
  });
  await renderPage(PAGE, repo);

  const task = await region("Task");
  expect(within(task).getByRole("columnheader", { name: "Change" })).toBeTruthy();
  const changes = within(task)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").at(-1)!.textContent);
  expect(changes).toEqual(["", "Changed", "New", "Removed"]);
  expect(within(task).getByText("dueDate")).toBeTruthy();
  const rule = await region("Repeat rule");
  expect(within(rule).getAllByText("New")).toHaveLength(4);
});

/** US8 more 2: a waiting spec shows what is committed, its data model included, not the disk's. */
test("the data model shows its committed version while the worktree holds an edit", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const worktree = join(repo, ".worktrees", SPEC_FEATURE);
  git(repo, "worktree", "add", "--quiet", worktree, SPEC_FEATURE);
  const path = join(worktree, DATA);
  writeFileSync(
    path,
    readFileSync(path, "utf8")
      .replace("Entities that the feature adds or changes.", "An uncommitted intro.")
      .replace("## Repeat rule", "## Uncommitted entity"),
  );
  await renderPage(PAGE, repo);

  await region("Repeat rule");
  expect(screen.getByText("Entities that the feature adds or changes.")).toBeTruthy();
  expect(screen.queryByText("An uncommitted intro.")).toBeNull();
  expect(screen.queryByRole("region", { name: "Uncommitted entity" })).toBeNull();
});

/** The text before the first entity sits in a card of its own, as the entities do. */
test("the data model's intro is drawn in a part of its own", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const intro = await region("Data model");
  expect(intro.textContent).toContain("Entities that the feature adds or changes.");
  expect(within(intro).queryByRole("table")).toBeNull();
});

/** Review focus 5 */
test("a spec without a data model has no Data part", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  commitOnBranch(repo, SPEC_FEATURE, { [DATA]: null });
  await renderPage(PAGE, repo);

  await region("Architecture");
  expect(await entries()).not.toContain("Data");
  expect(screen.queryByRole("heading", { name: "Data" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Task" })).toBeNull();
});

/**
 * The spec with items the core does not classify: an item of the units' list without a bold name,
 * one of the criteria's without an id, and sub-bullets under a unit, a tradeoff, and a criterion;
 * and a unit whose bold name holds code.
 */
function withUnclassifiedItems(repo: string) {
  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  const store =
    "- **The task store** completes tasks, and runs the one-time upgrade of saved due dates.\n";
  const tradeoff = "- No history of completions, as the repeating tasks decision accepts.\n";
  const criterion =
    "- **SC-001** (two clicks): Setting a preset repeat takes two clicks from the open task.\n";
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec
      .replace(
        store,
        `${store}  - It keeps the last upgrade's version.\n- The sync runs nightly.\n- **The \`ura\` CLI** reads the same rules.\n`,
      )
      .replace(tradeoff, `${tradeoff}  - Undo covers the last completion only.\n`)
      .replace(
        criterion,
        `${criterion}  - Counted from the task's edit panel.\n- All tests pass.\n`,
      ),
  });
}

/** A block of a part a review taps, by the start of its text. */
const tappable = (part: HTMLElement, text: string) =>
  within(part).getByRole("button", { name: new RegExp(`^${text}`) });

/** The parts drop no text: what the core does not classify shows as the spec's other blocks do. */
test("an architecture's item without a bold name, and nested bullets, show and take comments", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  withUnclassifiedItems(repo);
  await renderPage(PAGE, repo);

  const part = await region("Architecture");
  expect(tappable(part, String.raw`The sync runs nightly\.`)).toBeTruthy();
  expect(tappable(part, String.raw`It keeps the last upgrade's version\.`)).toBeTruthy();
  expect(tappable(part, String.raw`Undo covers the last completion only\.`)).toBeTruthy();
  expect(part.textContent).toContain("reads the same rules.");
});

/** The criteria drop no text either: an item without an id, and a criterion's nested bullet. */
test("a criteria item without an id, and a criterion's nested bullet, show and take comments", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  withUnclassifiedItems(repo);
  await renderPage(PAGE, repo);

  const part = await region("Success criteria");
  expect(tappable(part, String.raw`All tests pass\.`)).toBeTruthy();
  expect(tappable(part, String.raw`Counted from the task's edit panel\.`)).toBeTruthy();
  expect(within(part).getByText("SC-002")).toBeTruthy();
});
