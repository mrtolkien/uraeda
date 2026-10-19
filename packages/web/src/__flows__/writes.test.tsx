// Flow: a write to git. A button that writes shows what it does at once, with a progress, while
// every other button that writes is blocked, the item's card says the same until the server's
// status for it changes, a refused commit gives the button back with its error, and a field's save
// stays free. The writes of the priorities and the inbox are in their flows; these are the commits
// of the round and the agent's start.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { runWrite } from "../writes/store.ts";
import { click, fixtureRepo, git, holding, startApp, type } from "./harness.tsx";

const WEB_UI = "2026-10-11-web-ui";
const ROUND = `/f/${WEB_UI}/clarifications-01.md`;

/** Where the feature's branch began. */
let featureBase = "";

/** The fixture repository, with the web UI's feature in its worktree. */
function repository() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", WEB_UI), WEB_UI);
  featureBase = git(repo, "rev-parse", WEB_UI).trim();
  return repo;
}

const app = startApp({ agent: true, repo: repository });

/** The feature's worktree. */
const worktree = () => join(app.repo, ".worktrees", WEB_UI);

/** Gives the round every answer, in the feature's worktree, from the commit the branch began at. */
function answerRound() {
  git(worktree(), "reset", "--hard", "--quiet", featureBase);
  git(worktree(), "clean", "-fdq");
  const path = join(worktree(), "specs", WEB_UI, "clarifications-01.md");
  writeFileSync(
    path,
    readFileSync(path, "utf8").replaceAll(/^\*\*Answer:\*\*$/gm, "**Answer:** A"),
  );
}

/** The feature's card in the sidebar, by the link to its page. */
function card(slug: string) {
  const nav = within(screen.getByRole("navigation", { name: "Side navigation" }));
  return nav.getAllByRole("link").find((link) => link.getAttribute("href")?.endsWith(slug))!;
}

/** The agent's message field. */
const field = () => screen.getByRole("textbox", { name: "Message Claude Code" });

/** The buttons of the page that write to git are disabled in the same way. */
const blocked = (button: HTMLElement) => button.getAttribute("aria-disabled") === "true";

test("a commit shows its action at once, blocks the other buttons that write, and shows on its card", async () => {
  answerRound();
  const held = holding('"answers.submit"');
  await app.open(ROUND);
  const only = await screen.findByRole("button", { name: "Commit only" });

  await click(screen.getByRole("button", { name: "Commit and start the agent" }));

  // In the render after the click, before the server answers: a running action, never a guess.
  const running = screen.getByRole("button", { name: "Committing…" });
  expect(running.querySelector('[role="status"]')).toBeTruthy();
  expect(blocked(only)).toBe(true);
  expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
  expect(card("web-ui").getAttribute("aria-label")).toContain("Committing…");
  // Blocked, the button keeps the focus and sends nothing.
  only.focus();
  expect(document.activeElement).toBe(only);
  await click(only);
  expect(held.seen()).toBe(1);
  // Saving a field is no commit: it stays free. And a card still opens its page.
  expect(blocked(screen.getByRole("button", { name: "Save notes" }))).toBe(false);
  await click(card("cli-tuis"));
  await waitFor(() => expect(window.location.pathname).toBe(app.path("/f/2026-10-12-cli-tuis")));

  await act(async () => held.release());
  await waitFor(() => expect(screen.queryAllByRole("progressbar")).toHaveLength(0));
});

test("a commit the hook refuses gives the button back, with the error, and the card its status", async () => {
  answerRound();
  const hooks = join(app.repo, ".git/hooks");
  git(app.repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused'\nexit 1\n", { mode: 0o755 });
  await app.open(ROUND);

  await click(await screen.findByRole("button", { name: "Commit only" }));

  // The error stays on the page, next to the action, until dealt with.
  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0), {
    timeout: 5000,
  });
  expect(blocked(screen.getByRole("button", { name: "Commit only" }))).toBe(false);
  expect(card("web-ui").getAttribute("aria-label")).not.toContain("Committing…");
  rmSync(join(hooks, "pre-commit"));
});

test("Start the agent shows on the feature's card at once", async () => {
  answerRound();
  const held = holding('"session.send"');
  await app.open(ROUND);
  await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/f/${WEB_UI}/session`)));
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  // The workflow's message is inserted for the human to read, unsent.
  await waitFor(() => expect(box.textContent?.length).toBeGreaterThan(0));
  await type(box, `${box.textContent}\nKeep it short.`);

  await click(screen.getAllByRole("button", { name: "Start the agent" }).at(-1)!);

  expect(card("web-ui").getAttribute("aria-label")).toContain("Starting the agent…");
  held.release();
});

test("Start the change waits for another page's write, not the typing", async () => {
  const done = Promise.withResolvers<boolean>();
  let write: Promise<boolean> | undefined;
  await app.open("/changes/new");
  await type(await screen.findByRole("textbox", { name: "Message Claude Code" }), "Centre the x");
  const start = screen.getByRole("button", { name: "Start the change" });
  expect(blocked(start)).toBe(false);

  act(() => {
    write = runWrite({ label: "Committing…" }, () => done.promise);
  });

  expect(blocked(start)).toBe(true);
  await type(field(), "Widen the sidebar");
  expect(field().textContent).toBe("Widen the sidebar");
  await act(async () => {
    done.resolve(true);
    await write;
  });
  expect(blocked(start)).toBe(false);
});
