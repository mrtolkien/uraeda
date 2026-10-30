// US3 3 and its more scenario 2: a commit a hook refuses after the page moved on is undone, its
// hook's output where it happened, at the verdict, and in the toast, which opens that place.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigateHere } from "../routes.tsx";
import { REFUSED_ID } from "../writes/useWriteQueue.ts";
import { click, fixtureRepo, refreshUntil, renderPage, today } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const OUTPUT = "spec.md:12: a sentence of 31 words";

today("2026-10-11");

/** A pre-commit hook in `repo` that refuses every commit, printing `OUTPUT`. */
function refusingHook(repo: string) {
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, `#!/bin/sh\necho "${OUTPUT}"\nexit 1\n`, { mode: 0o755 });
}

/** The toast of the git writes still landing or refused. */
const toast = () => screen.getByRole("status", { name: "Git writes" });

/** The hook's refusal where it happened, on the page. */
const refusedHere = () => document.getElementById(REFUSED_ID);

test("a refused commit shows its output on its file and in the toast", async () => {
  const repo = fixtureRepo();
  refusingHook(repo);
  await renderPage(`/f/${FOLDER}/spec.md`, repo);

  await click(await screen.findByRole("button", { name: "Approve" }));

  // Live updates do not reach these tests: the page reads the queue again, as on coming back.
  await refreshUntil(() => {
    expect(within(toast()).getByText("Approving the spec of Recurring tasks")).toBeTruthy();
    expect(refusedHere()?.textContent).toContain(OUTPUT);
  });
  expect(toast().textContent).toContain(OUTPUT);
  expect(within(toast()).getByRole("button", { name: "Dismiss" })).toBeTruthy();
  // The approval is undone: the spec awaits its verdict again.
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();

  await act(async () => navigateHere("/"));
  expect(refusedHere()).toBeNull();
  await click(within(toast()).getByRole("button", { name: "Open" }));

  expect(window.location.pathname).toMatch(new RegExp(`/f/${FOLDER}/spec\\.md$`));
  expect(window.location.hash).toBe(`#${REFUSED_ID}`);
  await waitFor(() => expect(refusedHere()?.textContent).toContain(OUTPUT));
  // Opened, it leaves the toast, and stays where it happened until dismissed there.
  expect(screen.queryByRole("status", { name: "Git writes" })).toBeNull();
});
