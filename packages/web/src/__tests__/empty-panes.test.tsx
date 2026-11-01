// The sidebar draws no pane with nothing to show: its line saying so, clipped to the folded rail's
// 52 px, read as a stray "Not".
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { NAV_KEY } from "../shell/columnWidth.ts";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

/** The fixture's repository with no feature or change started: nothing in progress. */
function nothingStarted() {
  const repo = fixtureRepo();
  for (const branch of git(repo, "branch", "--format=%(refname:short)").split("\n")) {
    if (branch && branch !== "main") {
      git(repo, "branch", "-D", branch);
    }
  }
  git(repo, "rm", "-rq", "specs/2026-10-10-cli-core", "specs/2026-10-10-stack-decision");
  git(repo, "commit", "-qm", "Nothing started");
  return repo;
}

/** The folded rail beside the repository's Home. */
async function foldedRail(repo: string) {
  window.localStorage.setItem(NAV_KEY, JSON.stringify({ folded: true }));
  await renderPage("/", repo);
  const nav = await screen.findByRole("navigation", { name: "Navigation" });
  await within(nav).findByRole("button", { name: "Unfold navigation" });
  return nav;
}

// Break: a pane always left out passes the test below; this one draws it while a feature is.
test("the folded rail draws the In progress pane while a feature is in progress", async () => {
  const nav = await foldedRail(fixtureRepo());
  await within(nav).findByRole("group", { hidden: true, name: "In progress" });
});

// The open column draws the same rows, which the closed rail clips: one check covers both.
test("the folded rail draws no In progress pane while nothing is", async () => {
  const nav = await foldedRail(nothingStarted());
  // Home's own line comes from the same features as the rail's panes: once drawn, so are they.
  await within(screen.getByRole("main")).findByText("Nothing in progress.");
  expect(within(nav).queryByRole("group", { hidden: true, name: "In progress" })).toBeNull();
  expect(within(nav).queryByText("Nothing in progress.")).toBeNull();
});
