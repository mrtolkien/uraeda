// US2 of the spec page: a decision's change reads as a ledger, on every page that draws one. Its
// rules not kept come first, each with a sign named for screen readers, a changed rule's words
// marked inside it; the unchanged rules and the other sections fold under their count, and a fold
// mounts nothing until opened. The colours and the strike are checked in the browser, in
// `__browser__/ledger.test.tsx`.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { atWidth, fixture, fixtureRepo, git, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;

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
const pane = (name: string, scope: HTMLElement = document.body) =>
  within(scope).findByRole("region", { name });

/** The signs a row can carry, by the name a screen reader reads. */
const SIGN = /^(Added|Changed|Removed)$/;

/** The names of the signs inside `scope`, in the page's order. */
const signs = (scope: HTMLElement) =>
  within(scope)
    .queryAllByRole("img", { name: SIGN })
    .map((sign) => sign.getAttribute("aria-label"));

/** The ledger's row holding `words`: the nearest element around them that carries a sign. */
function rowOf(scope: HTMLElement, words: RegExp) {
  let row: HTMLElement | null = within(scope).getByText(words);
  while (row && within(row).queryAllByRole("img", { name: SIGN }).length === 0) {
    row = row.parentElement;
  }
  expect(row, String(words)).toBeTruthy();
  return row!;
}

/** The sign a row carries. */
const signOf = (row: HTMLElement) => signs(row)[0];

const texts = (elements: ReadonlyArray<HTMLElement>) => elements.map((e) => e.textContent);

/** The words of a row marked added, then those marked removed. */
const insertions = (scope: HTMLElement) => texts(within(scope).queryAllByRole("insertion"));
const deletions = (scope: HTMLElement) => texts(within(scope).queryAllByRole("deletion"));

/** A file as the default branch of the spec-page fixture has it. */
const main = (path: string) => readFileSync(fixture(`spec-page/main/${path}`), "utf8");

/** The checks of US2's key scenarios on task storage's pane, wherever it is drawn. */
function expectTaskStorageLedger(storage: HTMLElement) {
  const stored = rowOf(storage, /^Data MUST be stored in IndexedDB/);
  expect(signOf(stored)).toBe("Changed");
  expect(insertions(stored)).toContain("only");
  const upgrade = rowOf(storage, /^An upgrade that cannot read a saved value MUST/);
  expect(signOf(upgrade)).toBe("Added");
  // Added whole, it reads plain: its sign says so.
  expect(insertions(upgrade)).toEqual([]);
  const merged = rowOf(storage, /^Components MUST NOT call IndexedDB/);
  expect(signOf(merged)).toBe("Removed");
  expect(deletions(merged).join(" ")).toMatch(/^Components MUST NOT call IndexedDB/);
  const rules = within(storage).getByRole("group", { name: "Rules" });
  expect(signs(rules).sort()).toEqual(["Added", "Changed", "Changed", "Removed"]);
  // The other sections, folded under their count, are not in the page.
  const others = within(storage).getByRole("button", {
    name: "Why, alternatives, consequences · 1 changed",
  });
  expect(others.getAttribute("aria-expanded")).toBe("false");
  expect(within(storage).queryByText(/A corrupted value costs the user that value/)).toBeNull();
}

/** US2 key 1, 2; SC-001 */
test("task storage reads as a ledger", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await pane("Task storage");
  expectTaskStorageLedger(storage);
  // Unfolded, the changed consequence comes with its sign.
  await click(
    within(storage).getByRole("button", { name: "Why, alternatives, consequences · 1 changed" }),
  );
  expect(signOf(rowOf(storage, /^A corrupted value costs the user that value/))).toBe("Added");
});

/** A section's heading takes an id only from its anchor: none repeats another element's. */
test("a ledger's ids are each the page's only one", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const storage = await pane("Task storage");
  const ids = [...storage.querySelectorAll("[id]")].map((element) => element.id);
  expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
});

/** US2 key 3 */
test("a new decision's rules read plain", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const repeating = await pane("Repeating tasks");
  const rules = within(repeating).getByRole("group", { name: "Rules" });
  expect(signs(rules)).toEqual(["Added", "Added", "Added"]);
  expect(insertions(repeating)).toEqual([]);
  // Its other sections fold under their names alone: every part of it is new.
  expect(
    within(repeating).getByRole("button", { name: "Why, alternatives, consequences" }),
  ).toBeTruthy();
  expect(within(repeating).queryByText(/we're a todo app, not a calendar/)).toBeNull();
});

/** The edge case "A decision is removed by the spec"; SC-001 */
test("a removed decision's rules are struck, with −", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const history = await pane("Task history");
  const rules = within(history).getByRole("group", { name: "Rules" });
  expect(signs(rules)).toEqual(["Removed", "Removed"]);
  // Each rule's words, and its check's, inside a deletion, which the browser test checks struck.
  expect(deletions(rules)).toEqual([
    "Completing a task MUST keep it, marked done, in the history.",
    "Checked by the store's tests.",
    "The history MUST be browsable by day.",
    "Checked by the UI tests.",
  ]);
  expect(insertions(history)).toEqual([]);
});

/** US2 more 1 */
test("unchanged rules fold under their count, and unfold", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const dates = await pane("Due dates");
  const kept = /^Due dates MUST be stored as/;
  const fold = within(dates).getByRole("button", { name: "1 rule unchanged" });
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  expect(within(dates).queryByText(kept)).toBeNull();
  await click(fold);

  expect(fold.getAttribute("aria-expanded")).toBe("true");
  expect(within(dates).getByText(kept)).toBeTruthy();
  // A kept rule carries no sign.
  expect(signs(within(dates).getByRole("group", { name: "Rules" }))).toEqual(["Changed"]);
});

/** A review of the spec, pending, holding `comments`, committed on the feature's branch. */
function pendingReview(repo: string, comments: ReadonlyArray<string>) {
  const tip = git(repo, "rev-parse", "--short=7", SPEC_FEATURE).trim();
  commitOnBranch(repo, SPEC_FEATURE, {
    [`specs/${SPEC_FEATURE}/spec-review.md`]: `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n${comments.join("\n")}`,
  });
}

/** Plan Task 4: "a fold holding a pending comment or the selection opens". */
test("a fold holding a pending comment opens, the comment shown", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  pendingReview(repo, [
    '## C1: Decision task-storage, line 30, under "Consequences"',
    "",
    "> - Stored data is tested in one place, and components stay free of storage code.",
    "",
    "Name the place.",
    "",
    '## C2: Decision due-dates, line 13, under "Rules"',
    "",
    "> - Due dates MUST be stored as `YYYY-MM-DD` strings. Checked by the `CalendarDay` type.",
    "",
    "And the time zone?",
    "",
  ]);
  await renderPage(PAGE, repo);

  const storage = await pane("Task storage");
  const others = within(storage).getByRole("button", {
    name: "Why, alternatives, consequences · 1 changed",
  });
  expect(others.getAttribute("aria-expanded")).toBe("true");
  const consequences = within(storage).getByRole("group", { name: "Consequences" });
  const kept = within(consequences).getByRole("button", { name: "2 parts unchanged" });
  expect(kept.getAttribute("aria-expanded")).toBe("true");
  const first = await within(storage).findByRole("group", {
    name: "C1 · decision task-storage, line 30",
  });
  expect(first.textContent).toContain("Name the place.");

  const dates = await pane("Due dates");
  const rule = within(dates).getByRole("button", { name: "1 rule unchanged" });
  expect(rule.getAttribute("aria-expanded")).toBe("true");
  expect(within(dates).getByText(/^Due dates MUST be stored as/)).toBeTruthy();
  const second = await within(dates).findByRole("group", {
    name: "C2 · decision due-dates, line 13",
  });
  expect(second.textContent).toContain("And the time zone?");
});

/** US2 more 2 */
test("the decisions page shows the same ledger", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage("/decisions/task-storage", repo);

  const change = await screen.findByRole("region", { name: /^Proposed by Recurring tasks/ });
  expectTaskStorageLedger(await pane("Task storage", change));
});

/** As a spec's folds: a fold a comment holds open closes on a tap, and opens again on the next. */
test("a fold held open by a pending comment closes on a tap", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  pendingReview(repo, [
    '## C1: Decision due-dates, line 13, under "Rules"',
    "",
    "> - Due dates MUST be stored as `YYYY-MM-DD` strings. Checked by the `CalendarDay` type.",
    "",
    "And the time zone?",
    "",
  ]);
  await renderPage(PAGE, repo);

  const dates = await pane("Due dates");
  const kept = /^Due dates MUST be stored as/;
  const fold = within(dates).getByRole("button", { name: "1 rule unchanged" });
  expect(fold.getAttribute("aria-expanded")).toBe("true");
  await click(fold);
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  expect(within(dates).queryByText(kept)).toBeNull();
  await click(fold);
  expect(fold.getAttribute("aria-expanded")).toBe("true");
  expect(within(dates).getByText(kept)).toBeTruthy();
});

/** "Marked in place": on the decision's own page, each section's parts keep the file's order. */
test("the decision's page keeps each section's parts in the file's order", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(`/f/${SPEC_FEATURE}/decisions/task-storage`, repo);

  const storage = await pane("Task storage");
  const consequences = within(storage).getByRole("group", { name: "Consequences" });
  const text = consequences.textContent ?? "";
  const order = [
    "Stored data is tested in one place",
    "Every feature that changes stored data",
    "A corrupted value costs the user that value",
  ].map((words) => text.indexOf(words));
  expect(order.every((at) => at >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(within(storage).queryAllByRole("button", { name: /unchanged$/ })).toEqual([]);
});

/** The edge case "A spec with no decision listed or changed" */
test("without a change, Decisions holds the relied-on table only", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const spec = `specs/${SPEC_FEATURE}/spec.md`;
  const text = git(repo, "show", `${SPEC_FEATURE}:${spec}`);
  // The branch's decisions as the default branch has them, and its spec listing none.
  commitOnBranch(repo, SPEC_FEATURE, {
    [spec]: text.replace(/\n- \*\*New: [\s\S]*?nothing left to govern\.\n/, "\n"),
    "specs/decisions/due-dates.md": main("specs/decisions/due-dates.md"),
    "specs/decisions/repeating-tasks.md": null,
    "specs/decisions/task-history.md": main("specs/decisions/task-history.md"),
    "specs/decisions/task-storage.md": main("specs/decisions/task-storage.md"),
  });
  await renderPage(PAGE, repo);

  const relied = await pane("Relied on");
  expect(within(relied).getByText("· 3")).toBeTruthy();
  expect(within(relied).getByRole("table")).toBeTruthy();
  for (const name of ["Task storage", "Repeating tasks", "Task history", "Due dates"]) {
    expect(screen.queryByRole("region", { name }), name).toBeNull();
  }
  expect(screen.queryAllByRole("img", { name: SIGN })).toEqual([]);
});
