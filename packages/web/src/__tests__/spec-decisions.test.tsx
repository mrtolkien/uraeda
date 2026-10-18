// US2 of the specs redesign: each decision the branch changes is a card after what you approve,
// its change marked in place from the core's comparison, each rule with its strength's icon, and
// each part taking a comment of its own. The colours, the measure, and nothing struck are checked
// in the browser, in `__browser__/spec.test.tsx`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { placeOf } from "../reviewField.ts";
import { navigate } from "../routes.tsx";
import { atRepo, atWidth, fixture, fixtureRepo, git, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const REVIEW = `specs/${SPEC_FEATURE}/spec-review.md`;
const TASK_STORAGE = "specs/decisions/task-storage.md";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** A decision's card, a region named by its title, once drawn. */
const card = (name: string) => screen.findByRole("region", { name });

/**
 * The text of the `n`th part of a card's section, `Rules` by default, from 1: the element its
 * toggle, the button that selects it, is named by.
 */
function partOf(scope: HTMLElement, n: number, section = "Rules") {
  const group = within(scope).getByRole("group", { name: section });
  const toggle = within(group).getAllByRole("button", { pressed: false })[n - 1];
  expect(toggle, `part ${n} of ${section}`).toBeTruthy();
  return document.getElementById(toggle!.getAttribute("aria-labelledby") ?? "")!;
}

const texts = (elements: ReadonlyArray<HTMLElement>) => elements.map((e) => e.textContent);

/** The words a part marks added, then those it marks removed. */
const added = (part: HTMLElement) => texts(within(part).queryAllByRole("insertion"));
const removed = (part: HTMLElement) => texts(within(part).queryAllByRole("deletion"));

/** The elements of a part drawn struck through. */
const struck = (part: HTMLElement) =>
  [part, ...part.querySelectorAll<HTMLElement>("*")].filter((element) =>
    getComputedStyle(element).textDecorationLine.includes("line-through"),
  );

/** The review file, as the comment form writes it, in the worktree it creates for the branch. */
const review = (repo: string) =>
  readFileSync(join(repo, ".worktrees", SPEC_FEATURE, REVIEW), "utf8");

/** The feature's branch, with `text` as task storage's decision. */
function taskStorage(repo: string, text: string) {
  commitOnBranch(repo, SPEC_FEATURE, { [TASK_STORAGE]: text });
}

/** Task storage as the default branch has it. */
const MAIN_TASK_STORAGE = () => readFileSync(fixture(`spec-page/main/${TASK_STORAGE}`), "utf8");

/** US2 1 */
test("a reworded rule marks its words in place, unstruck", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  const rule = partOf(storage, 2);
  expect(rule.textContent).toContain("tested on data saved by");
  expect(added(rule)).toEqual(["every earlier"]);
  // The rule's words, then its check's, on its muted line.
  expect(removed(rule)).toEqual(["the previous", "review, and by"]);
  expect(struck(rule)).toEqual([]);
  expect(within(storage).getAllByText("Changed").length).toBeGreaterThan(0);
});

/** US2 2 */
test("a rule merged away shows whole on a red tint behind 1 removed", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  const merged = "Components MUST NOT call IndexedDB or the idb library directly.";
  const fold = within(storage).getByRole("button", { name: "1 removed" });
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  await click(fold);

  expect(fold.getAttribute("aria-expanded")).toBe("true");
  // Removed whole: one run, read as removed, and not struck.
  expect(removed(storage)).toContain(merged);
  expect(struck(within(storage).getByText(merged))).toEqual([]);
});

/** US2 3 */
test("a comment on a decision's rule is saved with its decision and lines", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  await click(partOf(await card("Task storage"), 3));
  expect(screen.getByText('Decision task-storage, lines 19–20, under "Rules"')).toBeTruthy();
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {
    fireEvent.change(field, { target: { value: "Log it where I can see it" } });
  });
  await click(screen.getByRole("button", { name: "Add comment" }));

  await waitFor(() =>
    expect(review(repo)).toContain('## C1: Decision task-storage, lines 19–20, under "Rules"'),
  );
  // It shows under its rule, with Edit and Remove, as a comment on the spec's lines does.
  const note = await within(await card("Task storage")).findByRole("group", {
    name: "C1 · decision task-storage, lines 19–20",
  });
  expect(note.textContent).toContain("Log it where I can see it");
  expect(within(note).getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(within(note).getByRole("button", { name: "Remove" })).toBeTruthy();
});

/** The edge case "A comment on a removed part": it points to the default branch's lines. */
test("a comment on a removed rule is saved with the default branch's lines", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  await click(within(storage).getByRole("button", { name: "1 removed" }));
  await click(within(storage).getByText(/^Components MUST NOT call IndexedDB/));
  expect(
    screen.getByText('Decision task-storage, lines 16–17 removed, under "Rules"'),
  ).toBeTruthy();
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {
    fireEvent.change(field, { target: { value: "Keep this one" } });
  });
  await click(screen.getByRole("button", { name: "Add comment" }));

  await waitFor(() =>
    expect(review(repo)).toContain(
      '## C1: Decision task-storage, lines 16–17 removed, under "Rules"',
    ),
  );
  expect(
    await within(storage).findByRole("group", {
      name: "C1 · decision task-storage, lines 16–17 removed",
    }),
  ).toBeTruthy();
});

/** Review focus of task 8: an unsaved edit is kept by where its comment points, decision included. */
test("an edit of a decision comment is kept apart from one on the spec's same lines", () => {
  const comment = {
    endLine: 20,
    general: false,
    number: 1,
    quote: [],
    removed: false,
    startLine: 19,
    text: "",
  };
  expect(placeOf(comment)).toBe("lines 19–20");
  expect(placeOf({ ...comment, decision: "task-storage" })).toBe(
    "decision task-storage, lines 19–20",
  );
  expect(placeOf({ ...comment, decision: "task-storage", removed: true })).toBe(
    "decision task-storage, lines 19–20 removed",
  );
});

/** US2 more 1 */
test("each rule shows its strength's icon, named for screen readers", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  commitOnBranch(repo, SPEC_FEATURE, {
    "specs/decisions/due-dates.md": [
      "---\nstatus: proposed\napproved-by:\n---\n\n# Due dates\n",
      "Due dates are calendar days.\n\n## Rules\n",
      "- Due dates MUST be stored as `YYYY-MM-DD` text. Checked by the `CalendarDay` type.",
      "- Date arithmetic SHOULD go through `date-fns`. Checked by review.",
      "- Due dates MUST NOT carry a timezone. Checked by the store's tests.",
      "- Lists MAY sort by due date. Checked by review.",
      "- Dates read in the user's locale. Checked by review.\n",
    ].join("\n"),
  });
  await renderPage(PAGE, repo);

  const dates = await card("Due dates");
  // The core's strengths: the last rule names none, and draws no icon.
  expect(
    within(within(dates).getByRole("group", { name: "Rules" }))
      .getAllByRole("img")
      .map((icon) => icon.getAttribute("aria-label")),
  ).toEqual(["Must", "Should", "Must not", "May"]);
});

/** US2 more 4 */
test("a rewrapped paragraph counts as unchanged", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  taskStorage(
    repo,
    MAIN_TASK_STORAGE().replace(
      "UI code\nnever touches the database directly",
      "UI\ncode never touches the database directly",
    ),
  );
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  expect(within(storage).getByText("No change against the default branch")).toBeTruthy();
  expect(within(storage).queryAllByRole("insertion")).toEqual([]);
});

/** US2 more 6 */
test("an unlisted change shows, marked Not listed in the spec", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const dates = await card("Due dates");
  expect(within(dates).getAllByText("Changed").length).toBeGreaterThan(0);
  expect(within(dates).getByText("Not listed in the spec")).toBeTruthy();
  expect(added(partOf(dates, 2))).toEqual(["src/lib/dates.ts or date-fns."]);
});

/** The edge case "A decision the branch deletes". */
test("a deleted decision is a Removed card without a link", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const history = await card("Task history");
  expect(within(history).getByText("Removed")).toBeTruthy();
  expect(within(history).queryAllByRole("link")).toEqual([]);
  // Its old text, whole and readable, not folded away.
  const rule = within(history).getByText(/^Completing a task MUST keep it/);
  expect(rule.closest("[aria-expanded='false']")).toBeNull();
  expect(struck(rule)).toEqual([]);
  // A changed decision's title opens its page on the branch.
  const storage = await card("Task storage");
  expect(within(storage).getByRole("link", { name: "Task storage" }).getAttribute("href")).toBe(
    atRepo(`/f/${SPEC_FEATURE}/decisions/task-storage`),
  );
});

/** The edge case "A decision listed as changed, equal to the default branch's". */
test("a listed decision equal to main says so", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  taskStorage(repo, MAIN_TASK_STORAGE().replace("status: active", "status: proposed"));
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  expect(within(storage).getByText("No change against the default branch")).toBeTruthy();
  expect(within(storage).queryByRole("button", { name: /removed$/ })).toBeNull();
});

/** The error handling "Could not compare with the default branch." */
test("a decision that could not be compared says so", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  // The branch, rewritten without a parent: it shares no commit with the default branch.
  const tree = git(repo, "rev-parse", `${SPEC_FEATURE}^{tree}`).trim();
  const orphan = git(repo, "commit-tree", tree, "-m", "spec: alone").trim();
  git(repo, "branch", "--force", SPEC_FEATURE, orphan);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  expect(within(storage).getByText("Could not compare with the default branch.")).toBeTruthy();
  // Its text still shows, for the review.
  expect(within(storage).getByText(/^An upgrade that cannot read a saved value MUST/)).toBeTruthy();
});

/** The text of the spec's blocks a selection holds: the toggles pressed outside the cards. */
const pressedInSpec = () =>
  [...document.querySelectorAll<HTMLElement>("button[aria-pressed='true']")]
    .filter((button) => !button.closest("[id^='decision-']"))
    .map((button) => document.getElementById(button.getAttribute("aria-labelledby") ?? "")!);

/** A tap on a decision's part selects its lines in the decision, never the spec's same lines. */
test("a decision's part selected leaves the spec's blocks on the same lines unselected", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const rule = partOf(await card("Task storage"), 3);
  await click(rule);
  expect(screen.getByText('Decision task-storage, lines 19–20, under "Rules"')).toBeTruthy();
  expect(texts(pressedInSpec())).toEqual([]);
});

/** Nor does it open a fold of the spec holding the same lines. */
test("a decision's part selected opens no fold of the spec on the same lines", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  // The third rule pushed to lines 65–66, those of US1's more scenarios in the spec.
  taskStorage(
    repo,
    readFileSync(fixture(`spec-page/branch/${TASK_STORAGE}`), "utf8").replace(
      "## Rules\n",
      `## Rules\n${"\n".repeat(46)}`,
    ),
  );
  await renderPage(PAGE, repo);

  await click(partOf(await card("Task storage"), 3));
  expect(screen.getByText('Decision task-storage, lines 65–66, under "Rules"')).toBeTruthy();
  const story = await screen.findByRole("region", { name: "Make a task repeat" });
  const fold = within(story)
    .getAllByRole("button", { name: /^(1 more scenario|Fold the other scenarios)$/ })
    .find((button) => button.hasAttribute("aria-expanded"));
  expect(fold?.getAttribute("aria-expanded")).toBe("false");
  expect(texts(pressedInSpec())).toEqual([]);
});

/** The ui-behaviour decision: Back restores the items opened, a card's folds as the stories'. */
test("a decision's folds opened are open again on Back, with the stories' folds", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);
  await click(within(await card("Task storage")).getByRole("button", { name: "1 removed" }));
  const story = await screen.findByRole("region", { name: "Complete a repeating task" });
  await click(within(story).getByRole("button", { name: "3 more scenarios" }));

  await act(async () => navigate(atRepo(`/f/${SPEC_FEATURE}/proposal.md`)));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Task storage" })).toBeNull());
  await act(async () => window.history.back());

  const fold = within(await card("Task storage")).getByRole("button", { name: "1 removed" });
  expect(fold.getAttribute("aria-expanded")).toBe("true");
  const again = await screen.findByRole("region", { name: "Complete a repeating task" });
  expect(within(again).getByRole("button", { name: "Fold the other scenarios" })).toBeTruthy();
});
