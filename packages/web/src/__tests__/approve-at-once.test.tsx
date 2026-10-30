// US3 1, R83: an approval reads Approved at its press, before the server answers, and a refusal
// takes it back, the review shown again with its refusal.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, renderPage, serverFetch, today } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PAGE = `/f/${FOLDER}/spec.md`;
const WORKTREE = join(".worktrees", FOLDER);
const SPEC = join(WORKTREE, `specs/${FOLDER}/spec.md`);

today("2026-10-11");

/**
 * The fixture's repository, its feature's worktree made, and a `fetch` on its server that holds
 * the approval at the browser until `release` is called.
 */
function heldApproval() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", WORKTREE, FOLDER);
  const server = serverFetch(repo);
  const held = Promise.withResolvers<void>();
  let waiting = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes('"review.approve"')) {
      waiting = true;
      await held.promise;
    }
    return server(input, init);
  };
  return { fetch, release: () => act(async () => held.resolve()), repo, waiting: () => waiting };
}

/** The record of the spec's block, the title of its first pane, as an approval writes it. */
const APPROVED = /^Approved on \d{4}-\d{2}-\d{2}\.$/;

/** The server's refusal of a verdict on a file changed since its last commit. */
const REFUSED = "spec.md has changes not committed: the review is of the committed version";

// Break: the approval passing no optimistic result.
test("an approval reads Approved before the server answers", async () => {
  const held = heldApproval();
  await renderPage(PAGE, held.repo, { fetch: held.fetch });

  await click(await screen.findByRole("button", { name: "Approve" }));

  expect(held.waiting()).toBe(true);
  expect(screen.getByText(APPROVED)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  await held.release();
  await waitFor(() =>
    expect(readFileSync(join(held.repo, SPEC), "utf8")).toContain("status: approved\n"),
  );
  // The server's answer, by its own date, in place of the browser's.
  await waitFor(() => expect(screen.getByText("Approved on 2026-10-11.")).toBeTruthy());
});

// Break: the review's refusals kept by the review, not by its page.
test("a refused approval shows the review again, with its refusal", async () => {
  const held = heldApproval();
  await renderPage(PAGE, held.repo, { fetch: held.fetch });
  await click(await screen.findByRole("button", { name: "Approve" }));
  expect(screen.getByText(APPROVED)).toBeTruthy();
  // Changed meanwhile, not committed: the server refuses to approve it.
  const path = join(held.repo, SPEC);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace("status: awaiting-human", "status: approved"),
  );

  await held.release();

  await waitFor(() => expect(screen.getByText(REFUSED)).toBeTruthy());
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  expect(screen.queryByText(APPROVED)).toBeNull();
});
