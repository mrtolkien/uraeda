import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, renderPage, today, type } from "./helpers.tsx";

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

/**
 * A pre-commit hook in `repo` that holds every commit until `release` is called: the start's write
 * stays in the queue meanwhile.
 */
function heldCommits(repo: string) {
  const gate = join(repo, ".git/released");
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, `#!/bin/sh\nwhile [ ! -f "${gate}" ]; do sleep 0.05; done\n`, {
    mode: 0o755,
  });
  return () => writeFileSync(gate, "");
}

/**
 * US4 2: the text typed is saved first, then the start is planned, and its session opens with the
 * plan's message in the composer before the start's commit lands; the feature starts from the text.
 */
test("Start saves the text typed, then opens the session at once (US4 2)", async () => {
  const repo = fixtureRepo();
  const release = heldCommits(repo);
  await renderPage("/edit/specs/proposals/git-listener.md", repo);
  const typed = "# Git listener process\n\n## What\n\nStarted as typed.\n";
  await type(await edit(), typed);
  await type(screen.getByRole("textbox", { name: "Slug" }), "git-listener");

  await click(startButton());

  await waitFor(() => expect(window.location.pathname).toMatch(`/f/${STARTED}/session`));
  const composer = await screen.findByRole("textbox", { name: /^Message/ });
  await waitFor(() => expect(composer.textContent).toContain(`specs/${STARTED}/`));
  expect(screen.getByText("Starting the feature Git listener process")).toBeTruthy();
  // The commit still waits on its hook: the page did not wait for it.
  expect(git(repo, "branch", "--list", STARTED).trim()).toBe("");

  release();
  await waitFor(() => expect(git(repo, "branch", "--list", STARTED).trim()).not.toBe(""), {
    timeout: 10_000,
  });
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
