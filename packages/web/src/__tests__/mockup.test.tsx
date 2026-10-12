// The review's C1: a feature's mockups show inside the UI, and take comments while the spec waits
// for review, on the spec's line that links them, or as a general comment.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, test } from "vite-plus/test";
import { addMockup, click, fixtureRepo, git, renderPage, type } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const SPEC = `specs/${FOLDER}/spec.md`;
const WORKTREE = join(".worktrees", FOLDER);

beforeAll(() => {
  process.env.URA_TODAY = "2026-10-11";
});

/** The spec's review, as written in the feature's worktree. */
function review(repo: string) {
  const path = join(repo, WORKTREE, `specs/${FOLDER}/spec-review.md`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** The recurring tasks' spec, whose Mockups section links `mockups/repeat.html`, with the file. */
function specWithMockup() {
  const repo = fixtureRepo();
  addMockup(repo, FOLDER, "repeat.html");
  return repo;
}

async function comment(text: string) {
  await click(await screen.findByRole("button", { name: "Comment" }));
  await type(await screen.findByRole("textbox", { name: "Comment text" }), text);
  await click(screen.getByRole("button", { name: "Add comment" }));
}

test("a mockup shows in the UI, and a comment lands on the line that links it (C1)", async () => {
  const repo = specWithMockup();
  await renderPage(`/f/${FOLDER}/mockups/repeat.html`, repo);
  expect((await screen.findByTitle("repeat.html")).getAttribute("src")).toBe(
    `/mockups/specs/${FOLDER}/mockups/repeat.html`,
  );
  expect(screen.getByRole("link", { name: "Open in a new tab" }).getAttribute("target")).toBe(
    "_blank",
  );

  await comment("The menu needs a Never option");

  await waitFor(() =>
    expect(review(repo)).toMatch(
      /## C1: Lines? [\d–]+, under "Mockups"\n\n> - \[Repeat\]\(mockups\/repeat\.html\)/,
    ),
  );
  expect(review(repo)).toContain("\nThe menu needs a Never option\n");
});

/** Review focus 5 */
test("a mockup no line links gets a general comment (review focus 5)", async () => {
  const repo = specWithMockup();
  addMockup(repo, FOLDER, "extra.html");
  await renderPage(`/f/${FOLDER}/mockups/extra.html`, repo);

  await comment("Too dense");

  await waitFor(() =>
    expect(review(repo)).toContain("## C1: General\n\nMockup extra.html: Too dense"),
  );
});

test("no Comment once the spec is approved", async () => {
  const repo = specWithMockup();
  git(repo, "worktree", "add", "--quiet", WORKTREE, FOLDER);
  const path = join(repo, WORKTREE, SPEC);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace("status: awaiting-human", "status: approved"),
  );
  git(join(repo, WORKTREE), "commit", "--quiet", "--no-verify", "--all", "--message", "approve");

  await renderPage(`/f/${FOLDER}/mockups/repeat.html`, repo);

  expect(await screen.findByTitle("repeat.html")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Comment" })).toBeNull();
});
