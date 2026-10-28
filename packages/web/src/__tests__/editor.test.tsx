import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, git, renderPage, today, type } from "./helpers.tsx";

today("2026-10-12");

/** The editor's text field: the page opens on it, with no Edit to tap first (US5 5). */
const edit = () => screen.findByRole("textbox", { name: "Text" });

/** Presses the editor's Save. */
const saveText = () => click(screen.getByRole("button", { name: "Save" }));

/** A proposal file's Start, its single button: its key, Ctrl+Enter, follows its label. */
const startButton = () => screen.getByRole("button", { name: /^Start feature\b/ });

/** The folder, and branch, the fixture's proposal file starts as under the slug "git-listener". */
const STARTED = "2026-10-12-git-listener";

/**
 * Codex review: a proposal file has no Commit, as its Start commits it; Start stops when the text
 * shown could not be saved, and starts nothing.
 */
test("Start stops when the text could not be saved", async () => {
  const { repo } = await renderPage("/edit/specs/proposals/git-listener.md");
  const field = await edit();
  const file = join(repo, "specs/proposals/git-listener.md");
  writeFileSync(file, "# Theirs\n");
  const before = git(repo, "rev-parse", "HEAD");

  await type(field, "# Mine\n");
  await type(screen.getByRole("textbox", { name: "Slug" }), "git-listener");
  await click(startButton());

  expect(
    await screen.findByText("Your text is not saved: the feature was not started."),
  ).toBeTruthy();
  expect(git(repo, "rev-parse", "HEAD")).toBe(before);
  expect(git(repo, "branch", "--list", STARTED).trim()).toBe("");
});

/** US2 4: the text typed is saved first, and the feature starts from it. */
test("Start saves the text typed, then starts the feature from it (US2 4)", async () => {
  const { repo } = await renderPage("/edit/specs/proposals/git-listener.md");
  const typed = "# Git listener process\n\n## What\n\nStarted as typed.\n";
  await type(await edit(), typed);
  await type(screen.getByRole("textbox", { name: "Slug" }), "git-listener");

  await click(startButton());

  await waitFor(() => expect(git(repo, "branch", "--list", STARTED).trim()).not.toBe(""));
  expect(git(repo, "show", `${STARTED}:specs/${STARTED}/proposal.md`)).toContain(
    "Started as typed.",
  );
});

test("a save over a change made elsewhere keeps the text, and offers the new version", async () => {
  const { repo } = await renderPage("/edit/specs/proposals/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/proposals/git-listener.md"), "# Changed elsewhere\n");

  await type(field, "# Mine\n");
  await saveText();

  expect(
    await screen.findByText(
      "git-listener.md changed on disk since you opened it. Your text was not saved.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy my text" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(readFileSync(join(repo, "specs/proposals/git-listener.md"), "utf8")).toBe(
    "# Changed elsewhere\n",
  );
});
