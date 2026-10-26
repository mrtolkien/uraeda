import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, git, renderPage, today, type } from "./helpers.tsx";

today("2026-10-12");

/** Taps Edit on a written proposal, drawn, and returns its text field (US5 5). */
async function edit() {
  await click(await screen.findByRole("button", { name: "Edit" }));
  return screen.getByRole("textbox", { name: "Text" });
}

/** Presses the editor's Save. */
const saveText = () => click(screen.getByRole("button", { name: "Save" }));

/** Codex review: Commit stops when the text shown could not be saved. */
test("Commit stops when the text could not be saved", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  const file = join(repo, "specs/drafts/git-listener.md");
  writeFileSync(file, "# Theirs\n");
  const before = git(repo, "rev-parse", "HEAD");

  await type(field, "# Mine\n");
  await click(screen.getByRole("button", { name: "Commit" }));

  expect(await screen.findByText(/nothing was committed/)).toBeTruthy();
  expect(git(repo, "rev-parse", "HEAD")).toBe(before);
});

/** US2 4 */
test("Commit saves the text typed, then commits it (US2 4)", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const typed = "# Git listener process\n\n## What\n\nCommitted as typed.\n";
  await type(await edit(), typed);

  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  expect(git(repo, "show", "HEAD:specs/drafts/git-listener.md")).toBe(typed);
  expect(screen.queryByText("Unsaved changes")).toBeNull();
});

test("a save over a change made elsewhere keeps the text, and offers the new version", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");

  await type(field, "# Mine\n");
  await saveText();

  expect(
    await screen.findByText(
      "git-listener.md changed on disk since you opened it. Your text was not saved.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy my text" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
    "# Changed elsewhere\n",
  );
});
