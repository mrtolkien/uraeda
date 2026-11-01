// The sidebar draws no pane with nothing to show: its line saying so, clipped to the folded rail's
// 52 px, read as a stray "Not".
import { screen, waitFor, within } from "@testing-library/react";
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

// The open column draws the same rows, which the closed rail clips: one check covers both.
test("the folded rail draws no In progress pane while nothing is", async () => {
  window.localStorage.setItem(NAV_KEY, JSON.stringify({ folded: true }));
  await renderPage("/settings", nothingStarted());
  const nav = await screen.findByRole("navigation", { name: "Navigation" });
  await within(nav).findByRole("button", { name: "Unfold navigation" });
  // The inbox's count comes with the features: once it shows, the panes are drawn from them.
  await waitFor(() => expect(nav.textContent).toContain("Inbox10"));
  expect(within(nav).queryByText("In progress")).toBeNull();
  expect(within(nav).queryByText("Nothing in progress.")).toBeNull();
});
