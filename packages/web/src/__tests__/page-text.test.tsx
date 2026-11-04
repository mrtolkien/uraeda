// What a reading page draws outside its panes starts at its panes' left edge, a reading pane wide
// (`pageText`): a spec's group headings and its review's end, a round's "Settled without you" and
// its end. happy-dom lays nothing out: each is checked for `pageText`'s classes, on itself or the
// box that holds it.
import { screen } from "@testing-library/react";
import * as stylex from "@stylexjs/stylex";
import { expect, test } from "vite-plus/test";
import { pageText } from "../layout/Page.tsx";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { fixtureRepo, git, renderPage, today } from "./helpers.tsx";

today("2026-10-11");

/** Whether `element`, or a box holding it inside the page's main, takes the page's text column. */
function inTextColumn(element: HTMLElement) {
  const classes = stylex.props(pageText).className!.split(" ");
  for (let at: HTMLElement | null = element; at && at.tagName !== "MAIN"; at = at.parentElement) {
    if (classes.every((name) => at!.classList.contains(name))) {
      return true;
    }
  }
  return false;
}

const FOLDER = "2026-10-06-recurring-tasks";
const SPEC = `specs/${FOLDER}/spec.md`;

// Break: drop `pageText` from a spec's `Group` heading, its stories' intro, a part it does not know,
// or `YourReview`'s box; or put it on a box holding the panes.
test("a spec's group headings, loose text, and review's end start at its panes' edge", async () => {
  const repo = fixtureRepo();
  const spec = git(repo, "show", `${FOLDER}:${SPEC}`);
  commitOnBranch(repo, FOLDER, {
    [SPEC]: spec
      .replace("## User stories\n", "## User stories\n\nThe stories, most important first.\n")
      .replace("## Architecture\n", "## Rollout\n\nShipped behind no flag.\n\n## Architecture\n"),
  });
  await renderPage(`/f/${FOLDER}/spec.md`, repo);

  const decisions = await screen.findByRole("heading", { level: 2, name: /^Decisions/ });
  expect(inTextColumn(decisions)).toBe(true);
  const stories = await screen.findByRole("heading", { level: 2, name: /^User stories/ });
  expect(inTextColumn(stories)).toBe(true);
  expect(inTextColumn(await screen.findByText("The stories, most important first."))).toBe(true);
  expect(inTextColumn(await screen.findByText("Shipped behind no flag."))).toBe(true);
  // A pane keeps its own width, past the text column's where it is wider.
  expect(inTextColumn(screen.getByRole("region", { name: /^US1/ }))).toBe(false);
  const review = await screen.findByRole("heading", { level: 2, name: "Your review" });
  expect(inTextColumn(review)).toBe(true);
  expect(inTextColumn(await screen.findByRole("button", { name: "Approve" }))).toBe(true);
});

// Break: drop `pageText` from "Settled without you", or from the round's end.
test("a round's settled heading and its end start at its panes' edge", async () => {
  await renderPage("/f/2026-10-11-web-ui/clarifications-01.md", fixtureRepo());

  const settled = await screen.findByRole("heading", { level: 2, name: "Settled without you" });
  expect(inTextColumn(settled)).toBe(true);
  expect(inTextColumn(screen.getByRole("button", { name: /^Commit/ }))).toBe(true);
});
