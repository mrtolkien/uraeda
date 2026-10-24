// US1 key scenario 2 and more scenario 5: a question's example and its "Why it matters" are panes of
// their own, apart from its context, and a picked option says so.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atWidth, click, fixture, fixtureRepo, git, renderPage, today } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
const Q4 = "Where should the session open on the questions page?";

today("2026-10-11");

/** A repository whose round, in the feature's worktree, is the layout-look round's Q4 and Q5. */
function layoutLook() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  const round = readFileSync(fixture("round-layout-look/clarifications-01.md"), "utf8");
  writeFileSync(join(repo, ".worktrees", FOLDER, ROUND), round);
  return repo;
}

/** A question's section. */
const question = (id: string) => document.getElementById(id) as HTMLElement;

/** The card of a question's option, by its letter: the box that holds its checkbox. */
function optionCard(id: string, letter: string) {
  const box = within(question(id)).getByRole("checkbox", {
    name: new RegExp(String.raw`^Option ${letter}\b`),
  });
  return box.parentElement as HTMLElement;
}

test("Q4's example and why are panes of their own", async () => {
  atWidth(1440);
  await renderPage(PAGE, layoutLook());
  await screen.findByRole("heading", { name: Q4 });

  const example = within(question("Q4")).getByRole("region", { name: "Example" });
  expect(example.textContent).toMatch(/you are on a question about the next occurrence/i);
  expect(example.textContent).not.toContain("Example:");
  // The context holds the example no more: it shows once, in its pane.
  expect(within(question("Q4")).getAllByText(/you are on a question/i)).toHaveLength(1);

  const why = within(question("Q4")).getByRole("region", { name: "Why it matters" });
  expect(why.textContent).toMatch(/it decides how much of the question stays visible/i);
  expect(why.textContent).not.toContain("Why it matters:");
  expect(example.contains(why) || why.contains(example)).toBe(false);
  // Q5 has no example: no pane for it.
  expect(within(question("Q5")).queryByRole("region", { name: "Example" })).toBeNull();
});

test("a picked option says so", async () => {
  atWidth(1440);
  await renderPage(PAGE, layoutLook());
  await screen.findByRole("heading", { name: Q4 });
  expect(within(optionCard("Q4", "B")).queryByText("picked")).toBeNull();

  await click(optionCard("Q4", "B"));

  expect(await within(optionCard("Q4", "B")).findByText("picked")).toBeTruthy();
  expect(within(optionCard("Q4", "A")).queryByText("picked")).toBeNull();
  // The recommended option says so in its border, picked or not.
  expect(within(optionCard("Q4", "A")).getByText("★ Recommended")).toBeTruthy();
});
