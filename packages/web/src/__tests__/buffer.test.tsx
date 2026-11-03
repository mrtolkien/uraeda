// A file opened as a buffer (US5): `Space b` on a page showing one file opens the whole file, its
// frontmatter included, and its save writes it on the file's branch, never committing it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, fieldText, fixtureRepo, git, renderPage, today, type } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PATH = `specs/${FOLDER}/spec.md`;

today("2026-10-11");

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The checkout `branch` is in, from git's list of worktrees. */
function checkoutOf(repo: string, branch: string) {
  const entry = git(repo, "worktree", "list", "--porcelain")
    .split("\n\n")
    .find((lines) => lines.split("\n").includes(`branch refs/heads/${branch}`));
  return entry?.match(/^worktree (.*)$/m)?.[1];
}

// Breaks caught: the frontmatter dropped from the buffer's text; a save on the default branch, not
// the feature's; a save that commits.
test("Space b opens the page's file, frontmatter and all", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${FOLDER}/spec.md`, repo);
  await screen.findByRole("button", { name: "Approve" });
  const before = git(repo, "rev-parse", FOLDER);

  await act(async () => {
    press(" ");
    press("b");
  });

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/buffer/${PATH}`)));
  const field = await screen.findByRole("textbox", { name: PATH });
  const text = fieldText(field);
  expect(text.startsWith("---\n")).toBe(true);

  await type(field, `${text}\nA line typed in the buffer.\n`);
  await act(async () => void fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" }));

  await waitFor(() => {
    const checkout = checkoutOf(repo, FOLDER);
    expect(checkout).toBeDefined();
    expect(readFileSync(join(checkout!, PATH), "utf8")).toContain("A line typed in the buffer.");
  });
  // The default branch has no such file: a save there would make it.
  expect(existsSync(join(repo, PATH))).toBe(false);
  expect(git(repo, "rev-parse", FOLDER)).toBe(before);
});
