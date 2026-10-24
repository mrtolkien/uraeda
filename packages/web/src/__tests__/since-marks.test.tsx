// Spec page US5 and SC-003, past the fixture's three places: every part changed since your review
// is marked Δ wherever the page draws it, its words as runs, and no block of another document
// drawn under the page is.
import { screen, waitFor, within } from "@testing-library/react";
import {
  addRevisedSpec,
  commitOnBranch,
  reviewedSpec,
  SPEC_FEATURE,
} from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, click, fixtureRepo, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const BLOCK = "Spec to review, revision 2, about 10 minutes.";
const MARK = "Changed since your review";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** Every block marked in the page. */
const marks = () => within(screen.getByRole("main")).queryAllByRole("group", { name: MARK });

/** A data model of many paragraphs, so its block ids hold every changed block's of the spec. */
function longDataModel() {
  const lines = Array.from({ length: 90 }, (_, index) => `Line ${index} of the data model.`);
  return [
    "# Data model: Recurring tasks",
    ...lines,
    "## Task",
    "| Field   | Type | Change |\n| ------- | ---- | ------ |\n| `title` | text |        |",
  ].join("\n\n");
}

/** SC-003: a block of `data-model.md` is not marked by a spec block's id. */
test("the data model's blocks are not marked by the spec's changes", async () => {
  const repo = fixtureRepo();
  const folder = addRevisedSpec(repo);
  commitOnBranch(repo, folder, { [`specs/${folder}/data-model.md`]: `${longDataModel()}\n` });
  await renderPage(PAGE, repo);
  await screen.findByRole("region", { name: "Since your review · 3 parts changed" });
  await screen.findByText("Line 89 of the data model.");

  expect(marks()).toHaveLength(5);
  for (const mark of marks()) {
    expect(mark.textContent).not.toContain("of the data model");
  }
  expect(screen.getAllByText(/^Line \d+ of the data model\.$/)).toHaveLength(90);
  const ids = [...document.querySelectorAll("[id^='since-']")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

/** The page of a revised spec, `reviewed` making its revision 1 from the fixture's, once it draws. */
async function revised(reviewed: (text: string) => string) {
  const repo = fixtureRepo();
  addRevisedSpec(repo, { reviewed: (text) => reviewed(reviewedSpec(text)) });
  await renderPage(PAGE, repo);
  await screen.findByRole("region", { name: BLOCK });
}

/** The text of revision 2, `to`, for `from` in revision 1. */
const swap = (to: string, from: string) => (text: string) => {
  expect(text).toContain(to);
  return text.replace(to, from);
};

/** The "Since your review" pane, once it counts `count` parts changed. */
const sincePane = (count: number) =>
  screen.findByRole("region", { name: `Since your review · ${count} parts changed` });

/** Taps the place `name` of the pane, and waits for the focus to land in `region`. */
async function jumpsInto(pane: HTMLElement, name: string, region: HTMLElement) {
  await click(within(pane).getByRole("button", { name }));
  await waitFor(() => expect(region.contains(document.activeElement)).toBe(true));
}

/** US5: a row added to the decisions relied on is marked, and its place jumps to it. */
test("a relied-on row added since the review is marked in its table", async () => {
  const row =
    "| [Preview](../decisions/preview.md)               | the mockups are stories of the real components    |\n";
  await revised(swap(row, ""));

  const pane = await sincePane(4);
  const reliedOn = screen.getByRole("region", { name: "Relied on" });
  const sign = within(reliedOn).getByText(MARK);
  expect(sign.closest("tr")?.textContent).toContain("Preview");
  await jumpsInto(pane, "Decisions · 4", reliedOn);
});

/** US5: a mockup's link reworded marks its live window, and its place jumps to it. */
test("a mockup's link reworded marks its embed", async () => {
  await revised(swap("[Title with a repeat phrase]", "[Title with a phrase]"));

  const pane = await sincePane(4);
  const story = screen.getByRole("region", { name: /^US4 · / });
  expect(within(story).getAllByRole("group", { name: MARK })).toHaveLength(1);
  await jumpsInto(pane, "US4's journey", story);
});

/** US5: a story renamed carries the mark in its title, and its place jumps to its pane. */
test("a story renamed is marked in its title, its place jumping to its pane", async () => {
  await revised(swap("US3: Repeat on a custom schedule", "US3: Repeat on custom schedules"));

  const pane = await sincePane(4);
  const story = screen.getByRole("region", { name: "US3 · Repeat on a custom schedule" });
  expect(within(story).getByRole("heading").textContent).toMatch(/Δ/);
  await jumpsInto(pane, "US3 Repeat on a custom schedule", story);
});

/** US5: two sections renamed are two places, each marked in its title, jumping to its pane. */
test("two sections renamed are two places, their titles marked", async () => {
  await revised((text) =>
    swap("## Assumptions", "## Hypotheses")(swap("## Edge cases", "## Edge situations")(text)),
  );

  const pane = await sincePane(5);
  const names = within(pane)
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(names).toEqual(expect.arrayContaining(["Edge cases", "Assumptions"]));
  const assumptions = screen.getByRole("region", { name: "Assumptions" });
  expect(within(assumptions).getAllByRole("heading")[0]!.textContent).toMatch(/Δ/);
  await jumpsInto(pane, "Assumptions", assumptions);
});

/** US5: a more scenario changed opens its fold, so its mark shows. */
test("a more scenario changed opens its fold, marked", async () => {
  await revised(swap("due the day after tomorrow.", "due in two days."));

  const pane = await sincePane(4);
  const story = screen.getByRole("region", { name: "US2 · Complete a repeating task" });
  const [, scenario] = within(story).getAllByRole("group", { name: MARK });
  expect(within(scenario!).getByRole("insertion").textContent).toContain("the day after tomorrow.");
  await jumpsInto(pane, "US2, more scenario 3", story);
});

/** The one block marked in the region `name`, and its words struck and added. */
function markedIn(name: string | RegExp) {
  const [mark, ...others] = within(screen.getByRole("region", { name })).getAllByRole("group", {
    name: MARK,
  });
  expect(others).toHaveLength(0);
  const words = (role: string) =>
    within(mark!)
      .queryAllByRole(role)
      .map((element) => element.textContent);
  return { deleted: words("deletion"), inserted: words("insertion"), mark: mark! };
}

/** The answers of revision 1, with C2's undo at 4 seconds. */
const ANSWERS_THEN = `## Your review

- **C1** (add weekends): done. "Weekends" sits next to "weekdays" in the repeat menu.
- **C2** (undo too short): done. The undo now stays 4 seconds, in the task row.
- **C3** (French phrases): declined. The title parser knows English phrases only: other languages
  need their own feature, with a list of phrases per language.

## Decisions`;

/** US5: an answer, a criterion, a tradeoff, an edge case, and a decision's note show their runs. */
test("the words of each kind of part changed show as runs", async () => {
  await revised((text) =>
    [
      swap("## Decisions", ANSWERS_THEN),
      swap("takes two clicks", "takes three clicks"),
      swap("No history of completions,", "No completion history,"),
      swap("restarts from the new date", "restarts from the old date"),
      swap("due date moves when", "due date changes when"),
    ].reduce((at, change) => change(at), text),
  );
  await sincePane(7);

  const answer = markedIn("Your review, answered");
  expect([answer.deleted, answer.inserted]).toEqual([["4"], ["5"]]);
  const criterion = markedIn("Success criteria");
  expect([criterion.deleted, criterion.inserted]).toEqual([["three"], ["two"]]);
  expect(criterion.mark.textContent?.match(/SC-001/g)).toHaveLength(1);
  const tradeoff = markedIn("Architecture");
  expect([tradeoff.deleted, tradeoff.inserted]).toEqual([
    ["completion history,"],
    ["history of completions,"],
  ]);
  const edge = markedIn("Edge cases");
  expect([edge.deleted, edge.inserted]).toEqual([["old"], ["new"]]);
  expect(edge.mark.textContent).not.toContain("|");
  const note = markedIn("Repeating tasks");
  expect([note.deleted, note.inserted]).toEqual([["changes"], ["moves"]]);
  expect(note.mark.textContent).not.toContain("New:");
});

/** R24: a changed paragraph holding a link keeps its link, marked, rather than plain runs. */
test("a changed paragraph holding a link keeps it", async () => {
  await revised(swap("hold as\nwritten there", "hold as\nthey are written there"));
  await sincePane(4);

  const { deleted, inserted, mark } = markedIn("Assumptions");
  expect(within(mark).getByRole("link", { name: "clarifications" })).toBeTruthy();
  expect([deleted, inserted]).toEqual([[], []]);
});

/** US5: the places are in the page's order, what you approve first, not the file's. */
test("the places follow the page's order", async () => {
  await revised(
    swap(
      "| ✅        | ✅              | ⚠️        |",
      "| ✅        | ✅              | ✅        |",
    ),
  );

  const pane = await sincePane(4);
  expect(
    within(pane)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["What you approve", "Your review, answered", "US1's journey", "US2's journey"]);
});

/** The mockup's Contents: "Since your review" after what you approve; every decision counted (R21). */
test("Contents lists the pane after what you approve, and counts every decision", async () => {
  await revised((text) => text);

  const rows = within(screen.getByRole("list", { name: "Parts" }))
    .getAllByRole("link")
    .map((link) => link.textContent?.split("Δ")[0]?.trim());
  expect(rows.slice(0, 4)).toEqual([
    "What you approve",
    "Since your review",
    "Your review, answered",
    "Decisions · 4",
  ]);
});
