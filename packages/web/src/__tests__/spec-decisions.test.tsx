// US2 of the specs redesign: each decision the branch changes is a pane after what you approve,
// its change marked in place from the core's comparison, each rule with its strength's icon, and
// each part taking a comment of its own. The spec page's ledger (R6) draws the rows' signs and
// folds, checked in `ledger.test.tsx`; the colours and the measure in the browser, in
// `__browser__/spec.test.tsx` and `__browser__/ledger.test.tsx`.
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

/** A decision's pane, a region named by its title, once drawn. */
const card = (name: string) => screen.findByRole("region", { name });

/**
 * The parts of a card's section, `Rules` by default, in the ledger's order: the elements their
 * toggles, the buttons that select them, are named by.
 */
function partsOf(scope: HTMLElement, section = "Rules") {
  const group = within(scope).getByRole("group", { name: section });
  return within(group)
    .getAllByRole("button", { pressed: false })
    .map((toggle) => document.getElementById(toggle.getAttribute("aria-labelledby") ?? "")!);
}

/** The part of a card's `Rules` whose words match `words`. */
function partOf(scope: HTMLElement, words: RegExp) {
  const part = partsOf(scope).find((found) => words.test(found.textContent ?? ""));
  expect(part, String(words)).toBeTruthy();
  return part!;
}

/** The rule the branch rewords to be tested on data saved by every earlier version. */
const UPGRADE = /A change to stored data MUST come with a versioned upgrade/;
/** The rule the branch adds. */
const CORRUPTED = /An upgrade that cannot read a saved value MUST/;

const texts = (elements: ReadonlyArray<HTMLElement>) => elements.map((e) => e.textContent);

/** The words a part marks added, then those it marks removed. */
const added = (part: HTMLElement) => texts(within(part).queryAllByRole("insertion"));
const removed = (part: HTMLElement) => texts(within(part).queryAllByRole("deletion"));

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
test("a reworded rule marks its words in place", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  const rule = partOf(storage, UPGRADE);
  expect(rule.textContent).toContain("tested on data saved by");
  expect(added(rule)).toEqual(["every earlier"]);
  // The rule's words, then its check's, on its muted line.
  expect(removed(rule)).toEqual(["the previous", "review, and by"]);
  expect(within(storage).getAllByText("Changed").length).toBeGreaterThan(0);
});

/** US2 2 of the spec page: the rule shows among the changed ones, unfolded, removed whole. */
test("a rule merged away shows whole, among the changed rules", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  const merged = "Components MUST NOT call IndexedDB or the idb library directly.";
  expect(within(storage).queryByRole("button", { name: /removed$/ })).toBeNull();
  // Removed whole: one run, read as removed.
  expect(removed(partOf(storage, /^−Components MUST NOT/))).toEqual([
    merged,
    "Checked by ESLint's no-restricted-imports and no-restricted-globals in src/components/.",
  ]);
});

/** US2 3 */
test("a comment on a decision's rule is saved with its decision and lines", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  await click(partOf(await card("Task storage"), CORRUPTED));
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
  // The core's strengths: the last rule names none, and draws no icon. The rows' signs aside.
  expect(
    within(within(dates).getByRole("group", { name: "Rules" }))
      .getAllByRole("img")
      .map((icon) => icon.getAttribute("aria-label"))
      .filter((name) => !/^(Added|Changed|Removed)$/.test(name ?? "")),
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
  expect(added(partOf(dates, /^~Date arithmetic/))).toEqual(["src/lib/dates.ts or date-fns."]);
});

/** The edge case "A decision the branch deletes". */
test("a deleted decision is a Removed pane without a link", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const history = await card("Task history");
  expect(within(history).getByText("Removed")).toBeTruthy();
  expect(within(history).queryAllByRole("link")).toEqual([]);
  // Its old rules, whole, not folded away.
  expect(within(history).getByText(/^Completing a task MUST keep it/)).toBeTruthy();
  // A changed decision's pane links to its page on the branch.
  const storage = await card("Task storage");
  expect(
    within(storage)
      .getByRole("link", { name: "The whole decision, on its page" })
      .getAttribute("href"),
  ).toBe(atRepo(`/f/${SPEC_FEATURE}/decisions/task-storage`));
});

/** R88: the item's file name, in parentheses after its bold lead, is the lead's too. */
test("a removed decision's sentence says why, without its file's name", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const history = await card("Task history");
  const note = within(history).getByText(/Repeating tasks keep no history of completions/);
  expect(note.textContent).toMatch(/^Repeating tasks keep no history/);
  expect(within(history).queryByText("task-history.md")).toBeNull();
});

/** The edge case "A decision listed as changed, equal to the default branch's". */
test("a listed decision equal to main says so", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  taskStorage(repo, MAIN_TASK_STORAGE().replace("status: active", "status: proposed"));
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  expect(within(storage).getByText("No part changed against the default branch")).toBeTruthy();
  expect(within(storage).getByText("status: active → proposed")).toBeTruthy();
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

  const rule = partOf(await card("Task storage"), CORRUPTED);
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

  await click(partOf(await card("Task storage"), CORRUPTED));
  expect(screen.getByText('Decision task-storage, lines 65–66, under "Rules"')).toBeTruthy();
  const story = await screen.findByRole("region", { name: "Make a task repeat" });
  const fold = within(story)
    .getAllByRole("button", { name: /^(1 more scenario|Fold the other scenarios)$/ })
    .find((button) => button.hasAttribute("aria-expanded"));
  expect(fold?.getAttribute("aria-expanded")).toBe("false");
  expect(texts(pressedInSpec())).toEqual([]);
});

/** Task storage's other sections' fold. */
const OTHERS = "Why, alternatives, consequences · 1 changed";

/** The ui-behaviour decision: Back restores the items opened, a card's folds as the stories'. */
test("a decision's folds opened are open again on Back, with the stories' folds", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);
  await click(within(await card("Task storage")).getByRole("button", { name: OTHERS }));
  const story = await screen.findByRole("region", { name: "Complete a repeating task" });
  await click(within(story).getByRole("button", { name: "3 more scenarios" }));

  await act(async () => navigate(atRepo(`/f/${SPEC_FEATURE}/proposal.md`)));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Task storage" })).toBeNull());
  await act(async () => window.history.back());

  const fold = within(await card("Task storage")).getByRole("button", { name: OTHERS });
  expect(fold.getAttribute("aria-expanded")).toBe("true");
  const again = await screen.findByRole("region", { name: "Complete a repeating task" });
  expect(within(again).getByRole("button", { name: "Fold the other scenarios" })).toBeTruthy();
});

/** A decision with only a title and a note, proposed. */
const note = (title: string) =>
  `---\nstatus: proposed\napproved-by:\n---\n\n# ${title}\n\nA note.\n`;

/** The text of the fold buttons of a card, closed. */
const folds = (scope: HTMLElement) =>
  within(scope)
    .queryAllByRole("button", { expanded: false })
    .map((button) => button.textContent);

/** A part's sign, by the name a screen reader reads, when it has one. */
const sign = (part: HTMLElement) =>
  within(part)
    .queryByRole("img", { name: /^(Added|Changed|Removed)$/ })
    ?.getAttribute("aria-label");

/** The titles of the decision panes, in the order the page draws them. */
const cardTitles = () =>
  screen
    .getAllByRole("region")
    .filter((region) => region.id.startsWith("decision-"))
    .map(
      (region) =>
        document.getElementById(region.getAttribute("aria-labelledby") ?? "")?.textContent,
    );

/** US2 more 6: the listed decisions in the spec's order, then the unlisted ones, by name. */
test("the cards follow the spec's items, then the unlisted changes by name", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  commitOnBranch(repo, SPEC_FEATURE, {
    "specs/decisions/alpha-note.md": note("Alpha note"),
    "specs/decisions/zeta-note.md": note("Zeta note"),
  });
  await renderPage(PAGE, repo);
  await card("Zeta note");

  expect(cardTitles()).toEqual([
    "Repeating tasks",
    "Task storage",
    "Task history",
    "Alpha note",
    "Due dates",
    "Zeta note",
  ]);
});

/** US2 of the spec page: the kept rules fold behind their count, the other sections behind theirs. */
test("unchanged rules fold behind their count, and the other sections behind theirs", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  expect(folds(await card("Task storage"))).toEqual([OTHERS]);
  expect(folds(await card("Due dates"))).toEqual(["1 rule unchanged"]);
  expect(folds(await card("Repeating tasks"))).toEqual(["Why, alternatives, consequences"]);
});

/** US2 1 of the spec page: a reworded rule carries the sign `~`, an added one `+`, a kept one none. */
test("a part the branch rewords or adds has its sign, before its words", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await card("Task storage");
  expect(sign(partOf(storage, UPGRADE))).toBe("Changed");
  expect(partOf(storage, UPGRADE).textContent).toMatch(/^~A change/);
  expect(sign(partOf(storage, CORRUPTED))).toBe("Added");
  // The unchanged parts, behind their folds, carry none.
  await click(within(storage).getByRole("button", { name: OTHERS }));
  await click(within(storage).getByRole("button", { name: "2 parts unchanged" }));
  const kept = partsOf(storage, "Consequences").filter((part) => !sign(part));
  expect(kept.map((part) => part.textContent)).toEqual([
    "Stored data is tested in one place, and components stay free of storage code.",
    "Every feature that changes stored data needs an upgrade and its test.",
  ]);
});
