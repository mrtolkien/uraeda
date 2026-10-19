// US2 of the decisions pass: the decisions page draws a decision's rules as the spec page does,
// the strength's icon, the words, and the check on a muted line. The colours are the shared
// component's, so one drawing is checked here by its name and its classes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { fixtureRepo, renderPage } from "./helpers.tsx";

const GIT = "specs/decisions/git.md";
const WORDS = /^Tools MUST run the system/;

/** The rule's row: the nearest element holding its icon, its words, and its check. */
const rowOf = (words: RegExp) => {
  let row = screen.getByText(words).parentElement!;
  while (!within(row).queryByRole("img")) {
    row = row.parentElement!;
  }
  return row;
};

test("a MUST rule shows a green Must icon and its check on a muted line", async () => {
  await renderPage("/decisions/git");

  await screen.findByText(WORDS);
  const row = rowOf(WORDS);
  expect(within(row).getByRole("img", { name: "Must" })).toBeTruthy();
  expect(within(row).getByText("Checked by review.")).toBeTruthy();
  // Each rule is drawn once: the section's own bullets are not drawn as well.
  expect(screen.getAllByText(WORDS)).toHaveLength(1);
});

/** The first icon named "Must not" within `scope`, with its classes. */
function mustNot(scope: HTMLElement) {
  const icon = within(scope).getAllByRole("img", { name: "Must not" })[0]!;
  return { accessibleName: icon.getAttribute("aria-label"), classes: icon.getAttribute("class") };
}

test("the decisions page and the spec page name a MUST NOT the same way", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage("/decisions/task-storage", repo);
  await screen.findByText(/Components MUST NOT call IndexedDB/);
  const onLedger = mustNot(screen.getByRole("main"));
  document.body.replaceChildren();

  await renderPage(`/f/${SPEC_FEATURE}/spec.md`, repo);
  const storage = await screen.findByRole("region", { name: "Task storage" });
  const onSpec = mustNot(storage);

  expect(onLedger.accessibleName).toBe("Must not");
  expect(onLedger.accessibleName).toBe(onSpec.accessibleName);
  expect(onLedger.classes).toBe(onSpec.classes);
});

test("a rule with no check shows its icon and words only", async () => {
  const repo = fixtureRepo();
  const path = join(repo, GIT);
  writeFileSync(path, readFileSync(path, "utf8").replaceAll(" Checked by review.", ""));
  await renderPage("/decisions/git", repo);

  await screen.findByText(WORDS);
  expect(within(rowOf(WORDS)).getByRole("img", { name: "Must" })).toBeTruthy();
  expect(screen.queryByText(/Checked by/)).toBeNull();
});
