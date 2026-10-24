// Spec page US5 and SC-003, past the fixture's three places: every part changed since your review
// is marked Δ wherever the page draws it, its words as runs, and no block of another document
// drawn under the page is.
import { screen, within } from "@testing-library/react";
import { addRevisedSpec, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
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
